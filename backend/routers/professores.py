"""
Router de Professores — CRUD do "professor virtual".

Endpoints:
  POST   /professores            cria um professor (monta system_prompt no servidor)
  GET    /professores            lista os professores do usuário
  GET    /professores/{id}       detalhe
  DELETE /professores/{id}       remove (cascata em documents/chunks/sessions/results)

NOTA sobre auth: o MVP é single-user e o backend usa service_role (bypassa RLS),
então por enquanto o `user_id` é lido de uma variável de ambiente única
(MVP_USER_ID) ou do payload. Quando implementarmos auth, isso vira o auth.uid()
do JWT do Supabase via dependency.
"""

import os
from uuid import UUID

from fastapi import APIRouter, HTTPException

from models import Professor, ProfessorCreate
from services.supabase_client import get_supabase

router = APIRouter(prefix="/professores", tags=["professores"])


# ---------------------------------------------------------------------------
# System prompt template — espelha o spec do projeto
# ---------------------------------------------------------------------------

# {chunks_retrieved} é deixado como placeholder vazio aqui — será injetado
# em runtime, em cada chamada de chat/atividade, com o resultado do RAG.
# Guardamos no banco apenas a "casca" (sem chunks) para reuso.
SYSTEM_PROMPT_TEMPLATE = """Você é {name}, professor(a) de {discipline}.

Estilo de ensino: {teaching_style}

Datas importantes: {exam_dates}

Contexto do material do aluno (use como base principal das suas respostas):
{{chunks_retrieved}}

Instruções:
- Responda sempre com base no material acima quando relevante.
- Se a pergunta não estiver no material, use seu conhecimento geral mas avise o aluno.
- Seja {teaching_style}.
- Ao gerar questões, sempre inclua o campo "topico" indicando o tema.
- Ao corrigir, explique o motivo do erro de forma didática."""


def _build_system_prompt(payload: ProfessorCreate) -> str:
    """Monta o system_prompt parcial (sem chunks_retrieved ainda)."""
    return SYSTEM_PROMPT_TEMPLATE.format(
        name=payload.name,
        discipline=payload.discipline,
        teaching_style=payload.teaching_style or "didático e claro",
        exam_dates=payload.exam_dates or "(não informadas)",
    )


def _current_user_id() -> str:
    """User ID temporário enquanto não implementamos auth Supabase.

    Em produção (ou após Fase 7), trocar por uma dependency que lê o JWT
    do header Authorization e devolve auth.uid().
    """
    user_id = os.getenv("MVP_USER_ID")
    if not user_id:
        raise HTTPException(
            status_code=500,
            detail=(
                "MVP_USER_ID não configurado. Crie um usuário no Supabase Auth, "
                "copie o UUID e exporte como MVP_USER_ID no backend/.env."
            ),
        )
    return user_id


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("", response_model=Professor)
def create_professor(payload: ProfessorCreate):
    """Cria um professor virtual.

    O `system_prompt` é montado no servidor a partir do template fixo +
    dados do usuário. Isso evita prompt injection vindo do frontend.
    """
    sb = get_supabase()
    system_prompt = _build_system_prompt(payload)

    res = (
        sb.table("professors")
        .insert(
            {
                "user_id": _current_user_id(),
                "name": payload.name,
                "discipline": payload.discipline,
                "teaching_style": payload.teaching_style,
                "exam_dates": payload.exam_dates,
                "system_prompt": system_prompt,
            }
        )
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=500, detail="Falha ao criar professor")
    return res.data[0]


@router.get("")
def list_professors():
    """Lista os professores do usuário (mais recentes primeiro)."""
    sb = get_supabase()
    res = (
        sb.table("professors")
        .select("id, name, discipline, teaching_style, created_at")
        .eq("user_id", _current_user_id())
        .order("created_at", desc=True)
        .execute()
    )
    return {"items": res.data or []}


@router.get("/{professor_id}", response_model=Professor)
def get_professor(professor_id: UUID):
    """Detalhe de um professor."""
    sb = get_supabase()
    res = (
        sb.table("professors")
        .select("*")
        .eq("id", str(professor_id))
        .limit(1)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Professor não encontrado")
    return res.data[0]


@router.delete("/{professor_id}")
def delete_professor(professor_id: UUID):
    """Remove o professor e tudo associado (cascade via FKs)."""
    sb = get_supabase()
    res = (
        sb.table("professors")
        .delete()
        .eq("id", str(professor_id))
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Professor não encontrado")
    return {"deleted": str(professor_id)}
