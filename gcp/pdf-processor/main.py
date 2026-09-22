"""
Processamento pesado de PDF (extração + chunking + embedding + insert),
rodando no Google Cloud Run — sem o teto de 2s de CPU das Supabase Edge
Functions (ver docs/migracao-supabase.md e o comentário em
supabase/functions/api/routes/documentos.ts). Chamado por essa mesma rota
via HTTP, autenticado por um segredo compartilhado (header X-Api-Key).

Porta de backend/services/pdf.py (extração, PyMuPDF) e
backend/services/rag.py::chunk_text (tiktoken cl100k_base) — a mesma lógica
que já rodava sem essa restrição no Railway. O modelo de embedding é o
MESMO já usado em produção hoje (gemini-embedding-2, 768 dims, ver
supabase/functions/_shared/embeddings.ts) — trocar de modelo aqui
misturaria espaços vetoriais incompatíveis com os chunks já indexados.
"""

import json
import logging
import os
import re

import fitz  # PyMuPDF
import httpx
import tiktoken
from flask import Flask, jsonify, request
from supabase import create_client

# Cloud Run captura stdout/stderr automaticamente como log da revisão — sem
# isso, um erro só aparecia como "status 500" no log de requisição, sem o
# motivo (já aconteceu: precisei reproduzir local pra descobrir o que tinha
# falhado, quando bastava olhar o log se ele existisse).
logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

app = Flask(__name__)

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
GEMINI_API_KEY = os.environ["GEMINI_API_KEY"]
ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]
PDF_PROCESSOR_SECRET = os.environ["PDF_PROCESSOR_SECRET"]
STORAGE_BUCKET = os.environ.get("STORAGE_BUCKET", "materiais")

# Mesmos valores de _shared/claude.ts.
MODEL_SONNET = "claude-sonnet-5"
MODEL_HAIKU = "claude-haiku-4-5-20251001"

# Geração de módulos usava Sonnet — trocado pra Haiku (~4x mais barato por
# token de entrada) depois de medir que 74% do custo de IA do app inteiro
# vinha só daqui, e quase todo esse custo é ENTRADA (o material do aluno,
# não a resposta da IA — uma chamada típica manda ~89 mil tokens de material
# e recebe de volta só ~1 mil). Reverter é só trocar esta linha de volta pra
# MODEL_SONNET. Se a qualidade da segregação em capítulos cair muito na
# prática, é o primeiro lugar a olhar.
MODULES_MODEL = MODEL_HAIKU

# Orçamento de texto enviado ao Claude na organização — mesmo valor e mesma
# lógica de amostragem de api/routes/modulos.ts::materialDigest (que essa
# função porta). 240 mil caracteres são ~60 mil tokens, folgado nos 200 mil
# de contexto do Sonnet.
_MAX_DIGEST_CHARS = 240_000
_MIN_CHUNKS_POR_DOC = 6

# Mesmo texto de _shared/claude.ts::NOTACAO_MATEMATICA — regra única para
# tudo que a IA escreve e a tela mostra (ver ali as métricas de produção que
# a motivaram).
NOTACAO_MATEMATICA = (
    "NOTAÇÃO MATEMÁTICA OBRIGATÓRIA: "
    "1. TODA fórmula, variável com índice/expoente deve estar em LaTeX puro entre $ e $ "
    "2. Exemplos CORRETOS: $q_x$, $_tp_x$, $\\bar{A}_x$, $A_x^{(m)}$, $\\mu_{x+t}$, $\\ell_x$, $\\delta$, $\\int_0^1 f(t)\\,dt$ "
    "3. Use $ corretamente: 'a força $\\mu_{x+t}$ cresce' (no meio de frase também) "
    "4. PROIBIDO: subscrito Unicode (qₓ, ℓ₄₀), sobrescrito Unicode (ᵗ, ²), underscore/acento fora de $ "
    "5. LaTeX deve estar COMPLETO e VÁLIDO — sem quebras de linha, sem misturar notações "
    "6. Quando escrever fórmula complexa, mantenha tudo entre os mesmos $ ... $ "
    "7. Teste mentalmente: se copiar o texto entre $ para um compilador LaTeX, deve funcionar "
    "NUNCA misture LaTeX com Unicode ou extensão. Texto comum fica FORA dos cifrões."
)

# Mesmo schema de _MODULES_TOOL em _shared/claude.ts.
_MODULES_TOOL = {
    "name": "return_modules",
    "description": "Retorna os módulos (capítulos) em que o material foi organizado.",
    "input_schema": {
        "type": "object",
        "properties": {
            "modules": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {
                            "type": "string",
                            "description": "Título curto do módulo, como um capítulo de livro.",
                        },
                        "description": {
                            "type": "string",
                            "description": "1-2 frases sobre o que o módulo cobre.",
                        },
                        "topics": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "5-12 tópicos específicos e segregados cobertos pelo módulo.",
                            "minItems": 5,
                            "maxItems": 12,
                        },
                    },
                    "required": ["name", "description", "topics"],
                },
            },
        },
        "required": ["modules"],
    },
}

# Mesmos valores de backend/services/config.py (CHUNK_SIZE_TOKENS/
# CHUNK_OVERLAP_TOKENS) e de _shared/embeddings.ts (EMBEDDING_MODEL/DIMS) —
# não é escolha livre, precisa bater com o que já está em produção.
CHUNK_SIZE_TOKENS = 500
CHUNK_OVERLAP_TOKENS = 50
EMBEDDING_MODEL = "gemini-embedding-2"
EMBEDDING_DIMS = 768
LOTE = 64

_tokenizer = None


def get_tokenizer():
    global _tokenizer
    if _tokenizer is None:
        _tokenizer = tiktoken.get_encoding("cl100k_base")
    return _tokenizer


def get_supabase():
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def extract_text(file_bytes: bytes) -> str:
    """Porta de backend/services/pdf.py::extract_text."""
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    try:
        pages_text = [page.get_text("text") for page in doc]
    finally:
        doc.close()
    texto = "\n\n".join(t for t in pages_text if t.strip())
    # Postgres recusa o byte nulo em coluna de texto (22P05, "unsupported
    # Unicode escape sequence") - alguns PDFs (fontes corrompidas, extração
    # de certos scanners) embutem \x00 no texto extraído. Achado em produção:
    # falha_indexacao derrubava o upload inteiro (compensação apagava
    # documento e storage) por causa de um único caractere invisível.
    return texto.replace("\x00", "")


def chunk_text(text: str) -> list[str]:
    """Porta de backend/services/rag.py::chunk_text."""
    enc = get_tokenizer()
    tokens = enc.encode(text)
    if not tokens:
        return []

    step = CHUNK_SIZE_TOKENS - CHUNK_OVERLAP_TOKENS
    chunks: list[str] = []
    for start in range(0, len(tokens), step):
        window = tokens[start : start + CHUNK_SIZE_TOKENS]
        if not window:
            break
        chunks.append(enc.decode(window))
        if start + CHUNK_SIZE_TOKENS >= len(tokens):
            break
    return chunks


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Mesma chamada REST que _shared/embeddings.ts::embedTexts, em Python."""
    if not texts:
        return []
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{EMBEDDING_MODEL}:batchEmbedContents?key={GEMINI_API_KEY}"
    )
    body = {
        "requests": [
            {
                "model": f"models/{EMBEDDING_MODEL}",
                "content": {"parts": [{"text": t}]},
                "outputDimensionality": EMBEDDING_DIMS,
            }
            for t in texts
        ]
    }
    resp = httpx.post(url, json=body, timeout=60.0)
    resp.raise_for_status()
    data = resp.json()
    return [e["values"] for e in data.get("embeddings", [])]


@app.post("/processar")
def processar():
    if request.headers.get("X-Api-Key") != PDF_PROCESSOR_SECRET:
        return jsonify({"error": "nao_autorizado"}), 401

    payload = request.get_json(force=True, silent=True) or {}
    document_id = payload.get("document_id")
    professor_id = payload.get("professor_id")
    storage_path = payload.get("storage_path")
    if not document_id or not professor_id or not storage_path:
        return jsonify({"error": "payload_invalido"}), 400

    sb = get_supabase()

    try:
        file_bytes = sb.storage.from_(STORAGE_BUCKET).download(storage_path)
    except Exception as exc:  # noqa: BLE001 — reportado ao chamador, não é fatal pro processo
        logging.exception("falha_download (document_id=%s)", document_id)
        return jsonify({"error": f"falha_download: {exc}"}), 500

    try:
        texto = extract_text(file_bytes)
    except Exception as exc:  # noqa: BLE001
        logging.exception("falha_extracao (document_id=%s)", document_id)
        return jsonify({"error": f"falha_extracao: {exc}"}), 500

    # Código "sem_texto" reconhecido explicitamente pela rota chamadora
    # (documentos.ts) pra manter a mesma tela de "PDF sem texto" do frontend.
    if not texto.strip():
        return jsonify({"error": "sem_texto"}), 422

    chunks = chunk_text(texto)
    if not chunks:
        return jsonify({"error": "sem_texto"}), 422

    # Falha no meio da indexação não deixa chunk órfão: o chamador apaga a
    # linha de `documents` na compensação, e `chunks.document_id` tem
    # `on delete cascade` — os já inseridos somem junto.
    indexados = 0
    try:
        for inicio in range(0, len(chunks), LOTE):
            lote = chunks[inicio : inicio + LOTE]
            vetores = embed_texts(lote)
            sb.table("chunks").insert(
                [
                    {
                        "professor_id": professor_id,
                        "document_id": document_id,
                        "content": conteudo,
                        "embedding": vetor,
                        "chunk_index": inicio + i,
                    }
                    for i, (conteudo, vetor) in enumerate(zip(lote, vetores))
                ]
            ).execute()
            indexados += len(lote)
    except Exception as exc:  # noqa: BLE001
        logging.exception(
            "falha_indexacao (document_id=%s, chunks_ja_indexados=%d)", document_id, indexados
        )
        return jsonify({"error": f"falha_indexacao: {exc}"}), 500

    try:
        sb.table("documents").update({"raw_text": texto}).eq("id", document_id).execute()
    except Exception:  # noqa: BLE001
        # raw_text é só cópia de apoio (não é lido por nenhuma rota hoje) —
        # não vale derrubar uma indexação que já deu certo por causa disso.
        pass

    return jsonify({"chunks": indexados}), 200


def chunks_do_professor(sb, professor_id: str) -> list[dict]:
    """Todos os chunks do professor, paginando (mesmo teto de 1000 do PostgREST
    que motivou _shared/db.ts::selectAll)."""
    linhas: list[dict] = []
    pagina = 1000
    inicio = 0
    while True:
        resp = (
            sb.table("chunks")
            .select("document_id, chunk_index, content")
            .eq("professor_id", professor_id)
            .order("document_id")
            .order("chunk_index")
            .range(inicio, inicio + pagina - 1)
            .execute()
        )
        lote = resp.data or []
        linhas.extend(lote)
        if len(lote) < pagina:
            break
        inicio += pagina
    return linhas


def material_digest(sb, professor_id: str) -> str | None:
    """Porta de api/routes/modulos.ts::materialDigest — amostragem POR
    DOCUMENTO quando o material completo passa de _MAX_DIGEST_CHARS."""
    docs_resp = (
        sb.table("documents").select("id, name").eq("professor_id", professor_id).execute()
    )
    docs = docs_resp.data or []
    if not docs:
        return None
    nomes_doc = {d["id"]: d["name"] for d in docs}

    linhas = chunks_do_professor(sb, professor_id)
    if not linhas:
        return None

    por_doc: dict[str, list[dict]] = {}
    for linha in linhas:
        por_doc.setdefault(linha["document_id"], []).append(linha)

    total_chars = sum(len(linha["content"]) for linha in linhas)
    partes: list[str] = []

    for doc_id, chunks_originais in por_doc.items():
        chunks = chunks_originais
        if total_chars > _MAX_DIGEST_CHARS:
            cota = max(
                _MIN_CHUNKS_POR_DOC,
                round(len(chunks) * (_MAX_DIGEST_CHARS / total_chars)),
            )
            if cota < len(chunks):
                # Passo uniforme: começo, meio e fim do documento — o índice
                # e o sumário não dizem o que o capítulo 12 cobre.
                passo = len(chunks) / cota
                chunks = [
                    chunks[min(len(chunks) - 1, round(i * passo))] for i in range(cota)
                ]

        partes.append(f"\n\n===== DOCUMENTO: {nomes_doc.get(doc_id, 'sem nome')} =====\n")
        partes.extend(c["content"] for c in chunks)

    return "\n".join(partes)


# Backslash que não inicia um escape JSON válido — caso típico: LaTeX que o
# próprio prompt pede via NOTACAO_MATEMATICA ("\mu", "\ell", "\int"...).
# Mesma causa e mesma correção de score.ts::coerceStrList e
# resumos.ts::coerceStrList (lado Deno, corrigido no commit 14908f7) — este
# era o único lugar que ainda faltava: sem o retry, o parse quebrava em toda
# matéria com notação matemática (ex.: atuária) e a função devolvia [] em
# silêncio, então "Atualizar trilha" sempre respondia "nada novo" mesmo com
# material novo de verdade.
_INVALID_JSON_ESCAPE = re.compile(r'\\(?!["\\/bfnrtu])')


def _coerce_modules(valor):
    """Claude às vezes serializa o campo `modules` (array grande, com LaTeX)
    como uma STRING JSON em vez de um array de verdade dentro do próprio
    tool_use.input — mesmo comportamento que já motivou coerceStrList em
    score.ts, só que aqui no campo inteiro, não só numa lista de strings.
    Cobre os dois formatos vistos: string de `[...]` e string de todo o
    objeto `{"modules": [...]}`."""
    if isinstance(valor, str):
        parsed = None
        for candidato in (valor, _INVALID_JSON_ESCAPE.sub(lambda m: "\\\\", valor)):
            try:
                parsed = json.loads(candidato)
                break
            except (json.JSONDecodeError, TypeError):
                continue
        if parsed is None:
            logging.warning("modules veio como string e nao foi possivel parsear: %r", valor[:200])
            return []
        valor = parsed
    if isinstance(valor, dict):
        valor = valor.get("modules", [])
    return valor if isinstance(valor, list) else []


# Mesma tabela de _shared/claude.ts::_PRICING (USD por 1M tokens).
_PRICING = {"sonnet": (3.00, 15.00), "haiku": (0.80, 4.00)}


def estimate_cost(model_key: str, tokens_in: int, tokens_out: int) -> float:
    preco = _PRICING.get(model_key)
    if not preco:
        return 0.0
    preco_in, preco_out = preco
    return (tokens_in * preco_in + tokens_out * preco_out) / 1_000_000


def log_token_usage(
    sb,
    user_id: str | None,
    professor_id: str,
    model_key: str,
    operation: str,
    tokens_in: int,
    tokens_out: int,
    cost_usd: float,
) -> None:
    """Porta de _shared/claude.ts::logTokenUsage — best-effort, nunca derruba
    a operação principal por causa do log (mesmo comportamento do original)."""
    if not user_id:
        # Chamador antigo/de teste sem user_id: sem log em vez de inserir
        # violando o NOT NULL de token_logs.user_id.
        return
    try:
        sb.table("token_logs").insert(
            {
                "user_id": user_id,
                "professor_id": professor_id,
                "model": model_key,
                "operation": operation,
                "tokens_in": tokens_in,
                "tokens_out": tokens_out,
                "cost_usd": cost_usd,
            }
        ).execute()
    except Exception:  # noqa: BLE001
        logging.exception("falha ao registrar token_log (nao fatal)")


def generate_modules(
    sb, system_prompt: str, user_prompt: str, user_id: str | None, professor_id: str
) -> list:
    """Porta de _shared/claude.ts::generateModules — tool-forcing pra JSON estruturado."""
    resp = httpx.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json={
            "model": MODULES_MODEL,
            "max_tokens": 8192,
            "system": system_prompt,
            "messages": [{"role": "user", "content": user_prompt}],
            "tools": [_MODULES_TOOL],
            "tool_choice": {"type": "tool", "name": "return_modules"},
        },
        timeout=180.0,
    )
    if not resp.is_success:
        # raise_for_status() sozinho não mostra o corpo do erro — e é
        # exatamente o corpo que diz o motivo real (ex.: limite de tokens,
        # parâmetro inválido), não o texto genérico "400 Bad Request".
        raise RuntimeError(f"Anthropic API {resp.status_code}: {resp.text}")
    data = resp.json()

    uso = data.get("usage") or {}
    tokens_in = uso.get("input_tokens", 0)
    tokens_out = uso.get("output_tokens", 0)
    modelo_key = "haiku" if MODULES_MODEL == MODEL_HAIKU else "sonnet"
    log_token_usage(
        sb, user_id, professor_id, modelo_key, "module", tokens_in, tokens_out,
        estimate_cost(modelo_key, tokens_in, tokens_out),
    )

    for bloco in data.get("content", []):
        if bloco.get("type") == "tool_use" and bloco.get("name") == "return_modules":
            return _coerce_modules(bloco.get("input", {}).get("modules", []))
    raise RuntimeError("Claude não retornou os módulos no formato esperado.")


@app.post("/gerar-modulos")
def gerar_modulos():
    if request.headers.get("X-Api-Key") != PDF_PROCESSOR_SECRET:
        return jsonify({"error": "nao_autorizado"}), 401

    payload = request.get_json(force=True, silent=True) or {}
    professor_id = payload.get("professor_id")
    # Só pra registrar o custo do Sonnet em token_logs (painel
    # /admin/financeiro) — o chamador (modulos.ts) já validou a posse do
    # professor antes de chegar aqui, isso não é checagem de autorização.
    user_id = payload.get("user_id")
    if not professor_id:
        return jsonify({"error": "payload_invalido"}), 400

    sb = get_supabase()

    try:
        prof_resp = (
            sb.table("professors")
            .select("id, name, discipline")
            .eq("id", professor_id)
            .limit(1)
            .execute()
        )
    except Exception as exc:  # noqa: BLE001
        logging.exception("falha_professor (professor_id=%s)", professor_id)
        return jsonify({"error": f"falha_professor: {exc}"}), 500
    if not prof_resp.data:
        return jsonify({"error": "professor_nao_encontrado"}), 404
    professor = prof_resp.data[0]

    try:
        digest = material_digest(sb, professor_id)
    except Exception as exc:  # noqa: BLE001
        logging.exception("falha_digest (professor_id=%s)", professor_id)
        return jsonify({"error": f"falha_digest: {exc}"}), 500
    if not digest:
        # Sinal reconhecido pela rota chamadora (modulos.ts) pra manter a
        # mesma mensagem de "nenhum material enviado ainda".
        return jsonify({"error": "sem_material"}), 422

    try:
        existentes_resp = (
            sb.table("modules")
            .select("position, name, topics")
            .eq("professor_id", professor_id)
            .order("position")
            .execute()
        )
    except Exception as exc:  # noqa: BLE001
        logging.exception("falha_modulos_existentes (professor_id=%s)", professor_id)
        return jsonify({"error": f"falha_modulos_existentes: {exc}"}), 500
    existentes = existentes_resp.data or []

    system_prompt = (
        f"Você é um planejador pedagógico da disciplina {professor['discipline']}. "
        "Sua tarefa é organizar o material de estudo do aluno em módulos, como os "
        "capítulos de um livro didático: em ordem pedagógica (do fundamento ao "
        "avançado), sem sobreposição entre módulos, cobrindo todo o material."
    )

    # A trilha CRESCE: módulos existentes ficam de pé, a IA só acrescenta o
    # que ainda não está coberto — ver o mesmo raciocínio em modulos.ts.
    if existentes:
        ja_cobertos = "\n".join(
            f"- {m['name']}: {', '.join(m.get('topics') or []) or '(sem tópicos)'}"
            for m in existentes
        )
        instrucao = (
            "O aluno JÁ TEM uma trilha montada, listada abaixo em MÓDULOS "
            "EXISTENTES. Ela não pode ser refeita nem repetida.\n\n"
            "Compare o MATERIAL com os MÓDULOS EXISTENTES por PROFUNDIDADE, "
            "não por rótulo: dois textos sobre o mesmo assunto geral (ex. "
            "'seguro para duas vidas') não são o mesmo conteúdo se um deles "
            "traz fórmulas, derivações, casos especiais ou métodos que o "
            "outro não tem. Abaixo de cada módulo existente você só vê o "
            "TÍTULO e os TÓPICOS resumidos, não o material original que "
            "gerou aquele módulo — um material novo que aprofunda um tema "
            "com conteúdo técnico que não aparece nesses tópicos resumidos "
            "conta como NOVO, mesmo com título parecido.\n"
            "Na dúvida, prefira devolver um módulo novo (pode ser uma "
            "continuação do mesmo tema, tipo 'Parte 2' ou um subtópico mais "
            "específico) a descartar conteúdo: perder um capítulo que o "
            "aluno pagou pra ter é pior do que a trilha ficar com dois "
            "módulos próximos.\n"
            "Só devolva lista vazia se o material for mesmo uma repetição do "
            "que os tópicos abaixo já resumem — sem fórmula, técnica ou caso "
            "novo.\n\n"
            f"MÓDULOS EXISTENTES:\n{ja_cobertos}\n"
        )
    else:
        instrucao = (
            "Organize o material abaixo em 5 a 15 módulos, segregando bem os "
            "conceitos. Cada conceito-chave deve ter seu próprio módulo quando "
            "possível, em vez de agrupar muitos num só. Prefira mais módulos "
            "menores e focados a poucos módulos grandes e genéricos.\n"
        )

    user_prompt = (
        f"{instrucao}\n"
        "Para cada módulo devolvido dê um título curto (como capítulo de "
        "livro), uma descrição de 1-2 frases e a lista de 5-12 tópicos específicos e segregados — "
        "cada tópico deve ser um conceito distinto, detalhe específico ou aplicação que pode virar "
        "uma ou mais questões de quiz. Tópicos devem ser concretos e bem definidos, não genéricos.\n"
        "Exemplos de boa segregação: 'Probabilidade de morte no ano x', 'Força de mortalidade $\\mu_x$', "
        "'Relação entre probabilidade e força', 'Calculando com distribuição uniforme' (em vez de "
        "apenas 'Conceitos de mortalidade' que seria genérico).\n"
        f"{NOTACAO_MATEMATICA} "
        "Use a tool return_modules para responder.\n\n"
        f"MATERIAL:\n{digest}"
    )

    try:
        modules = generate_modules(sb, system_prompt, user_prompt, user_id, professor_id)
    except Exception as exc:  # noqa: BLE001
        logging.exception("falha_claude (professor_id=%s)", professor_id)
        return jsonify({"error": f"falha_claude: {exc}"}), 500

    return jsonify({"modules": modules}), 200


@app.get("/")
def saude():
    return jsonify({"status": "ok"}), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))
