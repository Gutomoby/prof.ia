"""
Normalização da notação matemática que a IA escreve.

O contrato com a tela é simples: matemática entre cifrões, em LaTeX; texto
comum fora. O frontend (components/ui/math-text.tsx) renderiza com KaTeX o que
está entre `$`, e o que sobra vai como texto puro.

O problema é que o modelo não cumpre o contrato de forma confiável. Medido nas
377 questões geradas em produção, com a instrução NOTACAO_MATEMATICA já
dizendo "PROIBIDO subscrito Unicode":

    218  com LaTeX entre cifrões (certo)
     42  com subscrito Unicode   -> "qₓ", "q₄₀", "H₀", "ₜpₓ"
     29  com expoente fora de $  -> "A_{40}^{1:20}"
     18  com subscrito fora de $ -> "Ā_x = (i/δ) × A_x"

Tudo que não está entre cifrões chega literal na tela: o aluno lê "q₄₀" ou
"A_{40}^{1:20}" no meio do enunciado.

Pedir melhor no prompt já foi tentado e é o que está acima. Este módulo troca o
pedido por conserto: uma passada determinística no texto, na fronteira entre a
IA e o banco. Vale para Gemini e Haiku igualmente, e não custa nem token nem
latência.

Princípio de segurança: o que JÁ está entre `$...$` nunca é tocado. LaTeX
válido não é reescrito — só o que ficou de fora do contrato.
"""

import re

# --- Tabelas Unicode -------------------------------------------------------

_SUB = {
    "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4",
    "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9",
    "ₐ": "a", "ₑ": "e", "ₒ": "o", "ₓ": "x", "ₕ": "h", "ₖ": "k",
    "ₗ": "l", "ₘ": "m", "ₙ": "n", "ₚ": "p", "ₛ": "s", "ₜ": "t",
    "₊": "+", "₋": "-", "₍": "(", "₎": ")",
}

_SUP = {
    "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4",
    "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9",
    "ᵃ": "a", "ᵇ": "b", "ᶜ": "c", "ᵈ": "d", "ᵉ": "e",
    "ᵍ": "g", "ʰ": "h", "ⁱ": "i", "ʲ": "j", "ᵏ": "k",
    "ˡ": "l", "ᵐ": "m", "ⁿ": "n", "ᵒ": "o", "ᵖ": "p",
    "ʳ": "r", "ˢ": "s", "ᵗ": "t", "ᵘ": "u", "ᵛ": "v",
    "ʷ": "w", "ˣ": "x", "ʸ": "y", "ᶻ": "z",
    "⁺": "+", "⁻": "-", "⁽": "(", "⁾": ")",
}

# Gregas e símbolos que o modelo escreve soltos. Viram comando LaTeX só quando
# já estamos dentro de um trecho que virou fórmula — ver _para_latex.
_SIMBOLOS = {
    "μ": r"\mu", "δ": r"\delta", "λ": r"\lambda", "σ": r"\sigma",
    "π": r"\pi", "θ": r"\theta", "α": r"\alpha", "β": r"\beta",
    "γ": r"\gamma", "ω": r"\omega", "Δ": r"\Delta", "Σ": r"\Sigma",
    "ℓ": r"\ell", "∞": r"\infty", "≈": r"\approx", "≠": r"\neq",
    "≤": r"\leq", "≥": r"\geq", "×": r"\times", "·": r"\cdot",
    "→": r"\to", "∫": r"\int", "√": r"\sqrt",
}

# Letra base de uma expressão matemática: latina, grega, ou com macron.
# "Ā" aparece decomposto (A + U+0304) ou pré-composto, então os dois entram.
_BASE = r"[A-Za-zÀ-ſΑ-ω]"

_SUB_CHARS = "".join(_SUB)
_SUP_CHARS = "".join(_SUP)

# Token já em ASCII-LaTeX solto: "A_{40}^{1:20}", "q_x", "_tp_x", "A_x^{(m)}"
_TOKEN_LATEX = re.compile(
    r"(?<![\\$\w])"                       # não colado em barra, cifrão ou palavra
    r"(_\{[^}\n]{1,20}\}|_[A-Za-z0-9])?"  # subscrito ANTES da base (ex.: _tp_x)
    rf"({_BASE}̄?)"                  # a base, com macron opcional
    r"((?:[_^]\{[^}\n]{1,20}\}|[_^][A-Za-z0-9]){1,4})"  # ao menos um _ ou ^
)

# Base seguida de sub/sobrescrito Unicode: "q₄₀", "ₜpₓ", "H₀", "A²"
_TOKEN_UNICODE = re.compile(
    rf"([{_SUB_CHARS}]*)"                 # subscrito antes (ₜ de ₜpₓ)
    rf"({_BASE}̄?)"                  # base
    rf"([{_SUB_CHARS}{_SUP_CHARS}]+)"     # sub/sobrescrito depois
)


def _macron(base: str) -> str:
    """'Ā' (pré-composto ou com U+0304) vira \\bar{A}."""
    if base in ("Ā", "ā"):
        return rf"\bar{{{base[0].translate(str.maketrans('Āā', 'Aa'))}}}"
    if len(base) == 2 and base[1] == "̄":
        return rf"\bar{{{base[0]}}}"
    return _SIMBOLOS.get(base, base)


def _chaves(conteudo: str) -> str:
    """Envolve em chaves quando tem mais de um caractere ('40' -> '{40}')."""
    return conteudo if len(conteudo) == 1 else f"{{{conteudo}}}"


def _converte_unicode(m: re.Match) -> str:
    antes, base, depois = m.group(1), m.group(2), m.group(3)

    sub_antes = "".join(_SUB.get(c, c) for c in antes)
    corpo = _macron(base)

    # Uma corrida de sub/sobrescritos pode misturar os dois ("A²ₓ"), então
    # agrupa por tipo mantendo a ordem em que apareceram.
    partes: list[str] = []
    atual, tipo = "", None
    for c in depois:
        t = "_" if c in _SUB else "^"
        if t != tipo and atual:
            partes.append(f"{tipo}{_chaves(atual)}")
            atual = ""
        tipo, atual = t, atual + (_SUB.get(c) or _SUP.get(c) or c)
    if atual:
        partes.append(f"{tipo}{_chaves(atual)}")

    # Notação atuarial de pré-subscrito ("ₜpₓ" = probabilidade de sobreviver t
    # anos). Em LaTeX, "_t" precisa de uma base antes do underscore, senão é
    # "Expected group after _" — daí o {} vazio, que é a forma padrão.
    prefixo = f"{{}}_{_chaves(sub_antes)}" if sub_antes else ""
    return f"${prefixo}{corpo}{''.join(partes)}$"


def _converte_latex(m: re.Match) -> str:
    antes, base, depois = m.group(1) or "", m.group(2), m.group(3)
    if antes:
        antes = "{}" + antes
    return f"${antes}{_macron(base)}{depois}$"


# Fórmula: abre e fecha em cifrão NÃO escapado. O `(?<!\\)` nas duas pontas é
# o que separa a fórmula do dinheiro: o modelo escreve preço como "R\$ 50.000"
# em português, e sem essa guarda o cifrão do real virava abertura de fórmula.
# O resultado era o KaTeX recebendo " 50.000,00, pagável no final do ano..."
# como se fosse LaTeX, e o aluno via um "R\" vermelho no meio do enunciado.
# Mesma regra em components/ui/math-text.tsx — os dois lados precisam concordar
# sobre onde uma fórmula começa e termina.
_FORMULA = re.compile(r"(?<!\\)\$(?:[^$\n\\]|\\.)+?(?<!\\)\$")


def _fora_dos_cifroes(texto: str, transformar) -> str:
    """Aplica `transformar` só nos trechos que NÃO estão entre $...$.

    É a garantia central do módulo: LaTeX que o modelo já escreveu certo passa
    intacto — só o que ficou fora do contrato é reescrito.
    """
    partes, ultimo = [], 0
    for m in _FORMULA.finditer(texto):
        partes.append(transformar(texto[ultimo : m.start()]))
        partes.append(m.group(0))
        ultimo = m.end()
    partes.append(transformar(texto[ultimo:]))
    return "".join(partes)


def _juntar_vizinhos(texto: str) -> str:
    """'$A$ $=$ $B$' vira '$A = B$'.

    Sem isso, uma expressão como "Ā_x = (i/δ) × A_x" viraria três fórmulas
    separadas por texto, e o KaTeX perderia o espaçamento de operador.
    """
    return re.sub(r"\$ *\$", " ", texto)


# Cifrão de dinheiro, não de fórmula. O modelo alterna entre "R\$ 50.000" e
# "R$ 50.000" no mesmo material; o segundo abre uma fórmula que só fecha no
# próximo cifrão do texto, engolindo a frase inteira e mandando para o KaTeX
# algo como " 50.000,00, pagável no final do ano de morte. Dado ".
# Escapar aqui deixa o resto do pipeline sem ambiguidade — o frontend
# (math-text.tsx) desescapa na hora de exibir.
_MOEDA = re.compile(r"(?<!\\)\b(R|US|U\$S)\$(?=\s*\d)")

# Cifrão solto também sem prefixo de moeda: linguagem de atuária escreve
# "benefício de $1 unidade" (unidade monetária genérica, sem "R$"/"US$"). Sem
# escapar, esse $ desemparelha a contagem de cifrões do resto do enunciado e
# gruda com a PRÓXIMA fórmula válida do texto — tudo entre os dois vira
# "fórmula" pro KaTeX, que não preserva espaço entre palavras em modo
# matemático (achado em produção: "1unidadepagávelnoinstanteexato...").
# Heurística: dígito(s) seguidos de espaço e uma PALAVRA (2+ letras) é prosa,
# não LaTeX. O {2,} é o que separa "$1 unidade" (prosa, escapar) de
# "$14400 e^{-\delta t}...$" (fórmula legítima: variável solta de 1 letra
# como e/x/t é sempre seguida de ^, _ ou operador, nunca de mais letras) —
# sem essa exigência, a primeira versão desta regex quebrava justamente esse
# tipo de fórmula válida, achado ao rodar contra o histórico real.
_DOLAR_SOLTO = re.compile(r"(?<!\\)\$(?=\d+\s+[a-zà-ÿ]{2,})")


def normalizar(texto: str) -> str:
    """Põe a matemática solta entre cifrões, sem tocar no que já está certo."""
    if not texto or "$" == texto.strip():
        return texto

    texto = _MOEDA.sub(r"\1\\$", texto)
    texto = _DOLAR_SOLTO.sub(r"\\$", texto)

    def passe(trecho: str) -> str:
        trecho = _TOKEN_UNICODE.sub(_converte_unicode, trecho)
        return _TOKEN_LATEX.sub(_converte_latex, trecho)

    return _juntar_vizinhos(_fora_dos_cifroes(texto, passe))


def normalizar_profundo(valor):
    """Aplica `normalizar` em toda string de uma estrutura aninhada.

    As questões chegam como lista de dicts com `alternativas` dentro, e os
    módulos como dicts com lista de `topics` — normalizar campo a campo daria
    esquecimento garantido no próximo campo que alguém adicionar.
    """
    if isinstance(valor, str):
        return normalizar(valor)
    if isinstance(valor, list):
        return [normalizar_profundo(v) for v in valor]
    if isinstance(valor, dict):
        return {k: normalizar_profundo(v) for k, v in valor.items()}
    return valor
