"""
Núcleo do RAG — chunking, embeddings (LOCAIS) e busca vetorial.

Pipeline de indexação (chamado quando o usuário sobe um documento):
    extract_text(pdf)  →  chunk_text(text)  →  embed_texts(chunks)  →  INSERT chunks

Pipeline de retrieval (chamado em cada mensagem do chat / atividade):
    embed_texts([query])  →  match_chunks (RPC pgvector)  →  top-k trechos

Embeddings: sentence-transformers/all-MiniLM-L6-v2 (384 dims). O modelo é
baixado da HuggingFace na primeira execução (~80 MB) e fica em cache local.
Depois disso é 100% offline e gratuito.
"""

from functools import lru_cache
from typing import Any
from uuid import UUID

import tiktoken

from services.config import settings
from services.supabase_client import get_supabase


# ---------------------------------------------------------------------------
# Modelo de embedding — carregado uma vez (lazy)
# ---------------------------------------------------------------------------


@lru_cache(maxsize=1)
def _get_embedder():
    """Carrega o SentenceTransformer uma única vez no processo.

    Import dentro da função para não pagar o custo de carregar torch
    quando outros módulos só importarem `chunk_text` ou tipos.
    """
    from sentence_transformers import SentenceTransformer

    return SentenceTransformer(settings.EMBEDDING_MODEL)


@lru_cache(maxsize=1)
def _get_tokenizer():
    """Tokenizer cl100k_base — boa aproximação universal para contar tokens."""
    return tiktoken.get_encoding("cl100k_base")


# ---------------------------------------------------------------------------
# Chunking
# ---------------------------------------------------------------------------


def chunk_text(
    text: str,
    chunk_size_tokens: int | None = None,
    overlap_tokens: int | None = None,
) -> list[str]:
    """Fragmenta texto em pedaços de ~chunk_size_tokens com overlap entre eles.

    Ex.: chunk=500, overlap=50 → janelas que andam de 450 em 450 tokens,
    com cada janela carregando 50 tokens do final da anterior. Isso evita
    que conceitos cortados na fronteira percam contexto.

    Tokens são contados pelo encoder cl100k_base (compatível com modelos
    OpenAI, mas usado aqui só como métrica). Esse encoder lida bem com PT-BR.
    """
    chunk_size = chunk_size_tokens or settings.CHUNK_SIZE_TOKENS
    overlap = overlap_tokens or settings.CHUNK_OVERLAP_TOKENS
    if overlap >= chunk_size:
        raise ValueError("overlap_tokens precisa ser menor que chunk_size_tokens")

    enc = _get_tokenizer()
    tokens = enc.encode(text)
    if not tokens:
        return []

    step = chunk_size - overlap
    chunks: list[str] = []
    for start in range(0, len(tokens), step):
        window = tokens[start : start + chunk_size]
        if not window:
            break
        chunks.append(enc.decode(window))
        # Se a janela atual já é a última (cobre até o fim), encerra.
        if start + chunk_size >= len(tokens):
            break
    return chunks


# ---------------------------------------------------------------------------
# Embeddings
# ---------------------------------------------------------------------------


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Gera embeddings (vetor de 384 floats) localmente, em batch.

    `normalize_embeddings=True` faz com que cosine similarity == dot product,
    e é o que o pgvector espera quando usamos `<=>` (cosine distance).

    Retorna lista de listas (não numpy) para serializar em JSON / pgvector.
    """
    if not texts:
        return []
    model = _get_embedder()
    vectors = model.encode(
        texts,
        normalize_embeddings=True,
        show_progress_bar=False,
        convert_to_numpy=True,
    )
    return vectors.tolist()


# ---------------------------------------------------------------------------
# Indexação (pipeline completo)
# ---------------------------------------------------------------------------


# Chunks por lote de embedding/insert. Um livro rende mais de mil pedaços, e
# cada linha carrega um vetor de 384 floats: em lote único o INSERT vira uma
# requisição de vários MB, que estoura no caminho e não indexa nada. 64 mantém
# a memória do encoder previsível e o corpo do POST em ordem de centenas de KB.
_LOTE = 64


def index_document(professor_id: UUID, document_id: UUID, text: str) -> int:
    """Chunkifica + embeda + insere chunks no banco, em lotes.

    Retorna o número de chunks indexados (útil para mostrar na UI:
    "documento processado em N pedaços").

    Era um lote único, com a ressalva no comentário de que "para documentos de
    até 200 páginas é suficiente". Um livro passa disso: o encode de mil e
    poucos chunks de uma vez segurava a thread por minutos e o INSERT resultante
    era grande demais para completar. Ver o histórico em
    services/supabase_client.py — os dois problemas apareciam juntos.
    """
    chunks = chunk_text(text)
    if not chunks:
        return 0

    sb = get_supabase()
    indexados = 0

    for inicio in range(0, len(chunks), _LOTE):
        lote = chunks[inicio : inicio + _LOTE]
        vetores = embed_texts(lote)
        sb.table("chunks").insert(
            [
                {
                    "professor_id": str(professor_id),
                    "document_id": str(document_id),
                    "content": conteudo,
                    "embedding": vetor,
                    "chunk_index": inicio + i,
                }
                for i, (conteudo, vetor) in enumerate(zip(lote, vetores))
            ]
        ).execute()
        indexados += len(lote)

    return indexados


# ---------------------------------------------------------------------------
# Retrieval
# ---------------------------------------------------------------------------


def search_chunks(
    professor_id: UUID,
    query: str,
    top_k: int | None = None,
) -> list[dict[str, Any]]:
    """Recupera os top-k chunks mais similares à query, dentro de um professor.

    Embeda a query localmente e chama a função SQL `match_chunks` que vive
    na migration. A função usa o operador `<=>` do pgvector (cosine distance).

    Cada item retornado tem: id, document_id, content, similarity (0..1).
    """
    k = top_k or settings.RAG_TOP_K
    [query_emb] = embed_texts([query])

    sb = get_supabase()
    res = sb.rpc(
        "match_chunks",
        {
            "query_embedding": query_emb,
            "match_professor_id": str(professor_id),
            "match_count": k,
        },
    ).execute()

    # Em caso de tabela vazia ou erro silencioso, vem [] em vez de None.
    return res.data or []
