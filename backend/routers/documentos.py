"""
Router de Documentos — upload de PDFs e textos que alimentam o RAG.

Endpoints:
  POST /documentos/pdf     upload de um arquivo PDF (multipart)
  POST /documentos/texto   envia texto digitado
  GET  /documentos         lista documentos de um professor (?professor_id=...)
  DELETE /documentos/{id}  remove documento (cascata em chunks)

Cada upload dispara: extração de texto -> chunking -> embeddings -> insert na tabela chunks.
"""

from uuid import UUID

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from models import DocumentTextCreate
from services.config import settings
from services.pdf import extract_text
from services.rag import index_document
from services.supabase_client import get_supabase

router = APIRouter(prefix="/documentos", tags=["documentos"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _ensure_professor_exists(professor_id: UUID) -> None:
    """Confirma que o professor existe — evita inserir órfãos no banco."""
    sb = get_supabase()
    res = (
        sb.table("professors")
        .select("id")
        .eq("id", str(professor_id))
        .limit(1)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Professor não encontrado")


# ---------------------------------------------------------------------------
# Upload de PDF
# ---------------------------------------------------------------------------


@router.post("/pdf")
async def upload_pdf(
    professor_id: UUID = Form(...),
    file: UploadFile = File(...),
):
    """Recebe um PDF, salva no Storage, extrai o texto e indexa para RAG.

    Fluxo:
      1. valida que é PDF
      2. lê os bytes
      3. extrai texto com PyMuPDF
      4. salva o arquivo original no bucket Supabase Storage
      5. cria registro em `documents`
      6. chama index_document → chunking + embeddings + insert em `chunks`

    Retorna: {document_id, chunks: int}
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="O arquivo precisa ser um PDF (.pdf)")

    _ensure_professor_exists(professor_id)

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Arquivo vazio")

    # 1) Extração local (sem rede)
    text = extract_text(content)
    if not text.strip():
        raise HTTPException(
            status_code=400,
            detail="Não foi possível extrair texto. O PDF pode ser escaneado/imagem.",
        )

    sb = get_supabase()

    # 2) Upload para o Storage. Caminho organizado por professor.
    storage_path = f"{professor_id}/{file.filename}"
    try:
        sb.storage.from_(settings.STORAGE_BUCKET).upload(
            path=storage_path,
            file=content,
            file_options={"content-type": "application/pdf", "upsert": "true"},
        )
    except Exception as exc:  # supabase-py lança exceção genérica em conflito
        raise HTTPException(status_code=500, detail=f"Falha no upload: {exc}") from exc

    # 3) Registro do documento
    doc_res = (
        sb.table("documents")
        .insert(
            {
                "professor_id": str(professor_id),
                "name": file.filename,
                "type": "pdf",
                "storage_path": storage_path,
                "raw_text": text,
            }
        )
        .execute()
    )
    if not doc_res.data:
        raise HTTPException(status_code=500, detail="Falha ao criar registro de documento")
    document_id = UUID(doc_res.data[0]["id"])

    # 4) Indexação RAG (chunking + embeddings + insert)
    n_chunks = index_document(professor_id, document_id, text)

    return {
        "document_id": str(document_id),
        "name": file.filename,
        "chunks": n_chunks,
    }


# ---------------------------------------------------------------------------
# Upload de texto digitado
# ---------------------------------------------------------------------------


@router.post("/texto")
def upload_text(payload: DocumentTextCreate):
    """Adiciona um trecho de texto digitado (sem PDF) ao material do professor.

    Útil para anotações soltas, resumos pessoais, transcrições de aula, etc.
    Mesmo pipeline de chunking/embedding do PDF — só pula a etapa de extract_text.
    """
    _ensure_professor_exists(payload.professor_id)

    if not payload.raw_text.strip():
        raise HTTPException(status_code=400, detail="Texto não pode ser vazio")

    sb = get_supabase()
    doc_res = (
        sb.table("documents")
        .insert(
            {
                "professor_id": str(payload.professor_id),
                "name": payload.name,
                "type": "text",
                "raw_text": payload.raw_text,
            }
        )
        .execute()
    )
    if not doc_res.data:
        raise HTTPException(status_code=500, detail="Falha ao criar documento")
    document_id = UUID(doc_res.data[0]["id"])

    n_chunks = index_document(payload.professor_id, document_id, payload.raw_text)

    return {
        "document_id": str(document_id),
        "name": payload.name,
        "chunks": n_chunks,
    }


# ---------------------------------------------------------------------------
# Listagem e exclusão
# ---------------------------------------------------------------------------


@router.get("")
def list_documents(professor_id: UUID):
    """Lista os documentos de um professor (mais recentes primeiro)."""
    sb = get_supabase()
    res = (
        sb.table("documents")
        .select("id, name, type, created_at")
        .eq("professor_id", str(professor_id))
        .order("created_at", desc=True)
        .execute()
    )
    return {"items": res.data or []}


@router.delete("/{document_id}")
def delete_document(document_id: UUID):
    """Remove um documento e seus chunks (cascata via foreign key).

    Se for um PDF, também tenta remover do Storage. Erros de Storage não
    revertem o delete — o registro vai embora de qualquer forma.
    """
    sb = get_supabase()

    # Buscamos antes para saber se há arquivo no Storage para limpar.
    found = (
        sb.table("documents")
        .select("storage_path")
        .eq("id", str(document_id))
        .limit(1)
        .execute()
    )
    if not found.data:
        raise HTTPException(status_code=404, detail="Documento não encontrado")

    storage_path = found.data[0].get("storage_path")
    if storage_path:
        try:
            sb.storage.from_(settings.STORAGE_BUCKET).remove([storage_path])
        except Exception:
            # Storage opcional: não interrompe a exclusão do registro.
            pass

    sb.table("documents").delete().eq("id", str(document_id)).execute()
    return {"deleted": str(document_id)}
