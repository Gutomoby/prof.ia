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

import os

import fitz  # PyMuPDF
import httpx
import tiktoken
from flask import Flask, jsonify, request
from supabase import create_client

app = Flask(__name__)

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
GEMINI_API_KEY = os.environ["GEMINI_API_KEY"]
PDF_PROCESSOR_SECRET = os.environ["PDF_PROCESSOR_SECRET"]
STORAGE_BUCKET = os.environ.get("STORAGE_BUCKET", "materiais")

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
    return "\n\n".join(t for t in pages_text if t.strip())


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
        return jsonify({"error": f"falha_download: {exc}"}), 500

    try:
        texto = extract_text(file_bytes)
    except Exception as exc:  # noqa: BLE001
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
        return jsonify({"error": f"falha_indexacao: {exc}"}), 500

    try:
        sb.table("documents").update({"raw_text": texto}).eq("id", document_id).execute()
    except Exception:  # noqa: BLE001
        # raw_text é só cópia de apoio (não é lido por nenhuma rota hoje) —
        # não vale derrubar uma indexação que já deu certo por causa disso.
        pass

    return jsonify({"chunks": indexados}), 200


@app.get("/")
def saude():
    return jsonify({"status": "ok"}), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))
