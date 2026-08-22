/*
  Normalização da notação matemática que a IA escreve. Porta de services/notacao.py.

  O contrato com a tela é simples: matemática entre cifrões, em LaTeX; texto
  comum fora. O frontend (components/ui/math-text.tsx) renderiza com KaTeX o
  que está entre `$`, e o que sobra vai como texto puro.

  Princípio de segurança: o que JÁ está entre `$...$` nunca é tocado. LaTeX
  válido não é reescrito — só o que ficou de fora do contrato.

  Ver services/notacao.py para o raciocínio completo e as métricas de produção
  que motivaram cada regra.
*/

// --- Tabelas Unicode -------------------------------------------------------

const _SUB: Record<string, string> = {
  "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4",
  "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9",
  "ₐ": "a", "ₑ": "e", "ₒ": "o", "ₓ": "x", "ₕ": "h", "ₖ": "k",
  "ₗ": "l", "ₘ": "m", "ₙ": "n", "ₚ": "p", "ₛ": "s", "ₜ": "t",
  "₊": "+", "₋": "-", "₍": "(", "₎": ")",
};

const _SUP: Record<string, string> = {
  "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4",
  "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9",
  "ᵃ": "a", "ᵇ": "b", "ᶜ": "c", "ᵈ": "d", "ᵉ": "e",
  "ᵍ": "g", "ʰ": "h", "ⁱ": "i", "ʲ": "j", "ᵏ": "k",
  "ˡ": "l", "ᵐ": "m", "ⁿ": "n", "ᵒ": "o", "ᵖ": "p",
  "ʳ": "r", "ˢ": "s", "ᵗ": "t", "ᵘ": "u", "ᵛ": "v",
  "ʷ": "w", "ˣ": "x", "ʸ": "y", "ᶻ": "z",
  "⁺": "+", "⁻": "-", "⁽": "(", "⁾": ")",
};

// Gregas e símbolos que o modelo escreve soltos. Viram comando LaTeX só quando
// já estamos dentro de um trecho que virou fórmula — ver macron().
const _SIMBOLOS: Record<string, string> = {
  "μ": "\\mu", "δ": "\\delta", "λ": "\\lambda", "σ": "\\sigma",
  "π": "\\pi", "θ": "\\theta", "α": "\\alpha", "β": "\\beta",
  "γ": "\\gamma", "ω": "\\omega", "Δ": "\\Delta", "Σ": "\\Sigma",
  "ℓ": "\\ell", "∞": "\\infty", "≈": "\\approx", "≠": "\\neq",
  "≤": "\\leq", "≥": "\\geq", "×": "\\times", "·": "\\cdot",
  "→": "\\to", "∫": "\\int", "√": "\\sqrt",
};

// Letra base de uma expressão matemática: latina, grega, ou com macron.
// "Ā" aparece decomposto (A + U+0304) ou pré-composto, então os dois entram.
const _BASE = "[A-Za-zÀ-ſΑ-ω]";

const _SUB_CHARS = Object.keys(_SUB).join("");
const _SUP_CHARS = Object.keys(_SUP).join("");

// Token já em ASCII-LaTeX solto: "A_{40}^{1:20}", "q_x", "_tp_x", "A_x^{(m)}"
const _TOKEN_LATEX = new RegExp(
  "(?<![\\\\$\\w])" + // não colado em barra, cifrão ou palavra
    "(_\\{[^}\\n]{1,20}\\}|_[A-Za-z0-9])?" + // subscrito ANTES da base (ex.: _tp_x)
    `(${_BASE}̄?)` + // a base, com macron opcional
    "((?:[_^]\\{[^}\\n]{1,20}\\}|[_^][A-Za-z0-9]){1,4})", // ao menos um _ ou ^
  "g",
);

// Base seguida de sub/sobrescrito Unicode: "q₄₀", "ₜpₓ", "H₀", "A²"
const _TOKEN_UNICODE = new RegExp(
  `([${_SUB_CHARS}]*)` + // subscrito antes (ₜ de ₜpₓ)
    `(${_BASE}̄?)` + // base
    `([${_SUB_CHARS}${_SUP_CHARS}]+)`, // sub/sobrescrito depois
  "g",
);

/** 'Ā' (pré-composto ou com U+0304) vira \\bar{A}. */
function macron(base: string): string {
  if (base === "Ā" || base === "ā") {
    const letra = base === "Ā" ? "A" : "a";
    return `\\bar{${letra}}`;
  }
  if (base.length === 2 && base[1] === "̄") {
    return `\\bar{${base[0]}}`;
  }
  return _SIMBOLOS[base] ?? base;
}

/** Envolve em chaves quando tem mais de um caractere ('40' -> '{40}'). */
function chaves(conteudo: string): string {
  return conteudo.length === 1 ? conteudo : `{${conteudo}}`;
}

function converteUnicode(_match: string, antes: string, base: string, depois: string): string {
  const subAntes = [...antes].map((c) => _SUB[c] ?? c).join("");
  const corpo = macron(base);

  // Uma corrida de sub/sobrescritos pode misturar os dois ("A²ₓ"), então
  // agrupa por tipo mantendo a ordem em que apareceram.
  const partes: string[] = [];
  let atual = "";
  let tipo: "_" | "^" | null = null;
  for (const c of depois) {
    const t: "_" | "^" = c in _SUB ? "_" : "^";
    if (t !== tipo && atual) {
      partes.push(`${tipo}${chaves(atual)}`);
      atual = "";
    }
    tipo = t;
    atual += _SUB[c] ?? _SUP[c] ?? c;
  }
  if (atual) partes.push(`${tipo}${chaves(atual)}`);

  // Notação atuarial de pré-subscrito ("ₜpₓ" = probabilidade de sobreviver t
  // anos). Em LaTeX, "_t" precisa de uma base antes do underscore, senão é
  // "Expected group after _" — daí o {} vazio, que é a forma padrão.
  const prefixo = subAntes ? `{}_${chaves(subAntes)}` : "";
  return `$${prefixo}${corpo}${partes.join("")}$`;
}

function converteLatex(_match: string, antes: string | undefined, base: string, depois: string): string {
  const prefixo = antes ? `{}${antes}` : "";
  return `$${prefixo}${macron(base)}${depois}$`;
}

// Fórmula: abre e fecha em cifrão NÃO escapado. O `(?<!\\)` nas duas pontas é
// o que separa a fórmula do dinheiro: o modelo escreve preço como "R\$ 50.000"
// em português, e sem essa guarda o cifrão do real virava abertura de fórmula.
// Mesma regra em components/ui/math-text.tsx — os dois lados precisam
// concordar sobre onde uma fórmula começa e termina.
const _FORMULA = /(?<!\\)\$(?:[^$\n\\]|\\.)+?(?<!\\)\$/g;

/**
 * Aplica `transformar` só nos trechos que NÃO estão entre $...$.
 *
 * É a garantia central do módulo: LaTeX que o modelo já escreveu certo passa
 * intacto — só o que ficou fora do contrato é reescrito.
 */
function foraDosCifroes(texto: string, transformar: (s: string) => string): string {
  const partes: string[] = [];
  let ultimo = 0;
  for (const m of texto.matchAll(_FORMULA)) {
    const i = m.index ?? 0;
    partes.push(transformar(texto.slice(ultimo, i)));
    partes.push(m[0]);
    ultimo = i + m[0].length;
  }
  partes.push(transformar(texto.slice(ultimo)));
  return partes.join("");
}

/**
 * '$A$ $=$ $B$' vira '$A = B$'.
 *
 * Sem isso, uma expressão como "Ā_x = (i/δ) × A_x" viraria três fórmulas
 * separadas por texto, e o KaTeX perderia o espaçamento de operador.
 */
function juntarVizinhos(texto: string): string {
  return texto.replace(/\$ *\$/g, " ");
}

// Cifrão de dinheiro, não de fórmula. O modelo alterna entre "R\$ 50.000" e
// "R$ 50.000" no mesmo material; o segundo abre uma fórmula que só fecha no
// próximo cifrão do texto, engolindo a frase inteira. Escapar aqui deixa o
// resto do pipeline sem ambiguidade — o frontend (math-text.tsx) desescapa na
// hora de exibir.
const _MOEDA = /(?<!\\)\b(R|US|U\$S)\$(?=\s*\d)/g;

// Cifrão solto também sem prefixo de moeda: linguagem de atuária escreve
// "benefício de $1 unidade" (unidade monetária genérica, sem "R$"/"US$"). Sem
// escapar, esse $ desemparelha a contagem de cifrões do resto do enunciado e
// gruda com a PRÓXIMA fórmula válida do texto — tudo entre os dois vira
// "fórmula" pro KaTeX, que não preserva espaço entre palavras em modo
// matemático (achado em produção: "1unidadepagávelnoinstanteexato...").
// Heurística: dígito(s) seguidos de espaço e uma PALAVRA (2+ letras) é prosa,
// não LaTeX — variável solta de 1 letra (e/x/t) é sempre seguida de ^, _ ou
// operador, nunca de mais letras.
const _DOLAR_SOLTO = /(?<!\\)\$(?=\d+\s+[a-zà-ÿ]{2,})/g;

export function normalizar(texto: string | null | undefined): string {
  if (!texto || texto.trim() === "$") return texto ?? "";

  let t = texto.replace(_MOEDA, "$1\\$");
  t = t.replace(_DOLAR_SOLTO, "\\$");

  const passe = (trecho: string): string => {
    trecho = trecho.replace(_TOKEN_UNICODE, converteUnicode);
    trecho = trecho.replace(_TOKEN_LATEX, converteLatex);
    return trecho;
  };

  return juntarVizinhos(foraDosCifroes(t, passe));
}

/**
 * Aplica `normalizar` em toda string de uma estrutura aninhada.
 *
 * As questões chegam como lista de dicts com `alternativas` dentro, e os
 * módulos como dicts com lista de `topics` — normalizar campo a campo daria
 * esquecimento garantido no próximo campo que alguém adicionar.
 */
// deno-lint-ignore no-explicit-any
export function normalizarProfundo(valor: any): any {
  if (typeof valor === "string") return normalizar(valor);
  if (Array.isArray(valor)) return valor.map(normalizarProfundo);
  if (valor !== null && typeof valor === "object") {
    const resultado: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valor)) resultado[k] = normalizarProfundo(v);
    return resultado;
  }
  return valor;
}
