"""
Schemas Pydantic — define o formato dos dados que entram e saem da API.

Importante: estes schemas NÃO são tabelas do banco. As tabelas vivem no Supabase
(ver supabase/migrations/001_initial.sql). Aqui descrevemos apenas o "contrato"
HTTP, validando entradas e serializando respostas.
"""

from datetime import date, datetime
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


class ProfessorUpdate(BaseModel):
    """Edição parcial — só os campos enviados mudam.

    Todos são opcionais para permitir corrigir só o nome, por exemplo, sem
    reenviar o resto. exam_dates aceita null explícito para limpar a data.
    """
    name: str | None = None
    discipline: str | None = None
    teaching_style: str | None = None
    exam_dates: str | None = None


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

# Dificuldade do quiz — muda o estilo das questões, não a matéria.
Difficulty = Literal["facil", "medio", "dificil"]


class ActivityGenerateRequest(BaseModel):
    """Pede à IA para gerar uma atividade nova."""
    professor_id: UUID
    activity_type: ActivityType
    topic: str | None = Field(
        None,
        description="Tópico específico (ex.: 'Tábuas de Mortalidade'). Se vazio, IA escolhe.",
    )
    module_id: UUID | None = Field(
        None,
        description="Gerar o quiz cobrindo um módulo inteiro (ignora `topic`).",
    )
    difficulty: Difficulty | None = Field(
        None, description="Dificuldade das questões. Vazio = médio."
    )


class ActivitySubmitRequest(BaseModel):
    """Envia as respostas do usuário para correção/score."""
    activity_id: UUID
    answers: dict[str, Any]
    time_seconds: int


class QuestionCheckRequest(BaseModel):
    """Confere UMA questão, para a lição corrigir na hora.

    A lição mostra uma questão por vez e responde "certo/errado" no ato, então
    o cliente precisa do gabarito daquela questão. Ele não vem na geração de
    propósito (_strip_answers), senão o gabarito inteiro viajaria junto com o
    quiz e bastaria abrir o inspetor.
    """
    activity_id: UUID
    question_index: int
    answer: int


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


class TopicStat(BaseModel):
    topico: str
    n_questions: int
    accuracy_pct: float
    status: Literal["dominado", "pendente"]


class ScoreTrendPoint(BaseModel):
    data: datetime
    score_pct: float


class WeeklyGoal(BaseModel):
    quizzes_respondidos: int
    media_score_pct: float | None


class MonthlyGoal(BaseModel):
    topicos_dominados: int
    topicos_totais: int


class ScoreSummary(BaseModel):
    streak_days: int
    topics: list[TopicStat]
    score_trend: list[ScoreTrendPoint]
    weekly: WeeklyGoal
    monthly: MonthlyGoal
    overall_mastery_pct: float
    exam_dates: str | None  # repassado do professor, só informativo (texto livre)


# ---------------------------------------------------------------------------
# Plano de estudos (gerado por IA)
# ---------------------------------------------------------------------------


class StudyPlanContent(BaseModel):
    resumo: str
    prioridades: list[str]
    semana: list[str]
    mes: list[str]


class StudyPlan(BaseModel):
    id: UUID
    professor_id: UUID
    content: StudyPlanContent
    created_at: datetime


# ---------------------------------------------------------------------------
# Progressão global (XP, nível, sequência)
# ---------------------------------------------------------------------------


class UserProgress(BaseModel):
    total_xp: int
    level: int
    xp_no_nivel: int = Field(..., description="XP já acumulado dentro do nível atual.")
    xp_do_nivel: int = Field(..., description="XP total que o nível atual exige para fechar.")
    current_streak: int
    longest_streak: int
    last_activity_date: date | None
    daily_goal_xp: int = Field(..., description="Meta diária de XP escolhida pelo usuário.")
    xp_hoje: int = Field(..., description="XP acumulado hoje (fuso do usuário).")
    meta_licoes: int = Field(..., description="Lições por dia que fecham a meta da home.")
    licoes_hoje: int = Field(..., description="Lições concluídas hoje (fuso do usuário).")


class DailyGoalUpdate(BaseModel):
    daily_goal_xp: int = Field(..., ge=10, le=1000, description="Nova meta diária de XP.")


# ---------------------------------------------------------------------------
# Módulos (capítulos gerados por IA a partir do material)
# ---------------------------------------------------------------------------


class Module(BaseModel):
    id: UUID
    professor_id: UUID
    position: int
    name: str
    description: str | None
    topics: list[str]
    created_at: datetime
    # Derivados de activity_results (não persistidos na tabela):
    n_tentativas: int = 0
    melhor_score_pct: float | None = None


# ---------------------------------------------------------------------------
# Calendário
# ---------------------------------------------------------------------------


EventKind = Literal["prova", "revisao", "tarefa", "outro"]


class CalendarEventCreate(BaseModel):
    title: str
    kind: EventKind = "outro"
    event_date: date
    professor_id: UUID | None = Field(
        None, description="Matéria à qual o evento pertence. Vazio = evento geral."
    )


class CalendarEvent(BaseModel):
    id: UUID
    professor_id: UUID | None
    professor_name: str | None
    title: str
    kind: EventKind
    event_date: date


class CalendarActivity(BaseModel):
    """Um quiz respondido, já com a matéria resolvida para exibição."""
    id: UUID
    professor_id: UUID
    professor_name: str
    discipline: str
    topic: str | None
    score_pct: float
    created_at: datetime


class CalendarResponse(BaseModel):
    activities: list[CalendarActivity]
    events: list[CalendarEvent]


# ---------------------------------------------------------------------------
# Conquistas (tela 34) — derivadas do histórico, ver services/achievements.py
# ---------------------------------------------------------------------------


class Achievement(BaseModel):
    id: str = Field(..., description="Casa com o catálogo de copy do frontend.")
    ganha: bool
    data: date | None = Field(
        None, description="Dia em que o critério foi cumprido pela primeira vez."
    )
    atual: int = Field(..., description="Onde a pessoa está, na unidade do alvo.")
    alvo: int


class AchievementList(BaseModel):
    items: list[Achievement]
    ganhas: int
    total: int
