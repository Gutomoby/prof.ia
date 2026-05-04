"""
Schemas Pydantic — define o formato dos dados que entram e saem da API.

Importante: estes schemas NÃO são tabelas do banco. As tabelas vivem no Supabase
(ver supabase/migrations/001_initial.sql). Aqui descrevemos apenas o "contrato"
HTTP, validando entradas e serializando respostas.
"""

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Professores
# ---------------------------------------------------------------------------


class ProfessorCreate(BaseModel):
    """Payload para criar um novo professor."""
    name: str = Field(..., description="Nome do professor virtual (ex.: 'Prof. Carlos').")
    discipline: str = Field(..., description="Matéria ensinada (ex.: 'Atuária').")
    teaching_style: str | None = Field(
        None,
        description="Estilo de ensino livre — ex.: 'objetivo', 'usa muitos exemplos'.",
    )
    exam_dates: str | None = Field(
        None, description="Datas de provas reais, em texto livre."
    )


class Professor(ProfessorCreate):
    """Professor já persistido — inclui id e timestamps."""
    id: UUID
    user_id: UUID
    system_prompt: str | None
    created_at: datetime


# ---------------------------------------------------------------------------
# Documentos / RAG
# ---------------------------------------------------------------------------


class DocumentTextCreate(BaseModel):
    """Adicionar texto digitado (não-PDF) ao material de um professor."""
    professor_id: UUID
    name: str
    raw_text: str


class Document(BaseModel):
    id: UUID
    professor_id: UUID
    name: str
    type: Literal["pdf", "text"]
    storage_path: str | None
    created_at: datetime


# ---------------------------------------------------------------------------
# Chat
# ---------------------------------------------------------------------------


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str
    created_at: datetime | None = None


class ChatSendRequest(BaseModel):
    """Mensagem enviada pelo usuário no chat com o professor."""
    professor_id: UUID
    session_id: UUID | None = None  # se None, criamos uma nova sessão
    message: str


# ---------------------------------------------------------------------------
# Atividades (Quiz / Simulado / Prova / Reforço)
# ---------------------------------------------------------------------------


ActivityType = Literal["quiz", "simulado", "prova", "reforco"]


class ActivityGenerateRequest(BaseModel):
    """Pede à IA para gerar uma atividade nova."""
    professor_id: UUID
    activity_type: ActivityType
    topic: str | None = Field(
        None,
        description="Tópico específico (ex.: 'Tábuas de Mortalidade'). Se vazio, IA escolhe.",
    )


class ActivitySubmitRequest(BaseModel):
    """Envia as respostas do usuário para correção/score."""
    activity_id: UUID
    answers: dict[str, Any]
    time_seconds: int


class ActivityResult(BaseModel):
    id: UUID
    professor_id: UUID
    activity_type: ActivityType
    topic: str | None
    questions: list[dict[str, Any]]
    answers: dict[str, Any] | None
    score_pct: float | None
    time_seconds: int | None
    created_at: datetime


# ---------------------------------------------------------------------------
# Score
# ---------------------------------------------------------------------------


class ScoreByTopic(BaseModel):
    topic: str
    score_pct: float
    n_activities: int


class ScoreSummary(BaseModel):
    by_topic: list[ScoreByTopic]
    by_activity_type: list[dict[str, Any]]
    recommendation: str | None  # texto gerado pelo Haiku
