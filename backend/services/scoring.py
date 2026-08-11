"""
Correção de atividades e métricas agregadas (streak, domínio por tópico).

Usado por routers/atividades.py (correção pontual de uma tentativa) e por
routers/score.py (agregação de todas as tentativas de um professor).
"""

from datetime import date, datetime, timedelta
from uuid import UUID
from zoneinfo import ZoneInfo

from services.config import settings
from services.supabase_client import get_supabase

# Tudo que vira "dia" (sequência de estudo) é convertido para o fuso do usuário
# antes de virar date. Os timestamps do banco são timestamptz em UTC; contar o
# dia em UTC quebraria a sequência de quem estuda de noite no Brasil.
APP_TZ = ZoneInfo(settings.APP_TIMEZONE)


def to_local_date(value: str | datetime) -> date:
    """Converte um timestamp do banco (ISO/UTC) para a data no fuso do usuário."""
    dt = datetime.fromisoformat(value) if isinstance(value, str) else value
    return dt.astimezone(APP_TZ).date()


def today_local() -> date:
    return datetime.now(APP_TZ).date()

# Corte de "domínio" por tópico — mesmo critério visual já usado no Badge de
# score do histórico do quiz (verde >=70%, vermelho <40%, neutro no meio).
MASTERY_THRESHOLD_PCT = 70.0
MIN_QUESTIONS_FOR_MASTERY = 2


def correct_questions(questions: list[dict], answers: dict) -> tuple[list[dict], float]:
    """Cruza as respostas do usuário com o gabarito. Usado na submissão e ao revisitar."""
    corrected = []
    n_certas = 0
    for idx, q in enumerate(questions):
        resposta_usuario = answers.get(str(idx))
        correta = resposta_usuario == q["resposta_correta"]
        if correta:
            n_certas += 1
        corrected.append({**q, "resposta_usuario": resposta_usuario, "correta": correta})

    score_pct = round((n_certas / len(questions)) * 100, 1) if questions else 0.0
    return corrected, score_pct


def answered_activities(
    professor_id: UUID,
    before: datetime | None = None,
    with_questions: bool = True,
) -> list[dict]:
    """Tentativas de quiz já respondidas de um professor, mais recentes por último.

    `before`, se informado, limita às tentativas respondidas antes daquele
    instante — usado para comparar um snapshot de domínio por tópico "hoje"
    contra um snapshot de "N dias atrás" (ver monthly em routers/score.py).

    `with_questions=False` deixa de fora o JSONB `questions`/`answers`, que
    carrega enunciado, alternativas e explicação de cada questão. Quem só quer
    data e nota (sequência, gráfico de evolução) não deve pagar por isso: é a
    coluna mais pesada da tabela e cresce a cada quiz respondido.
    """
    sb = get_supabase()
    colunas = "questions, answers, score_pct, created_at" if with_questions else "score_pct, created_at"
    query = (
        sb.table("activity_results")
        .select(colunas)
        .eq("professor_id", str(professor_id))
        .eq("activity_type", "quiz")
        .not_.is_("score_pct", "null")
    )
    if before is not None:
        query = query.lt("created_at", before.isoformat())
    res = query.order("created_at").execute()
    return res.data or []


def topic_stats_from(activities: list[dict]) -> list[dict]:
    """Mesma agregação de `topic_stats`, mas sobre tentativas já buscadas.

    Existe para que quem precisa de dois recortes do mesmo histórico (hoje e
    30 dias atrás) faça UMA ida ao banco e filtre em memória, em vez de puxar
    o histórico inteiro duas vezes.
    """
    totals: dict[str, dict[str, int]] = {}
    for activity in activities:
        corrected, _ = correct_questions(activity["questions"], activity["answers"] or {})
        for q in corrected:
            topico = q.get("topico") or "Geral"
            bucket = totals.setdefault(topico, {"n_questions": 0, "n_certas": 0})
            bucket["n_questions"] += 1
            if q["correta"]:
                bucket["n_certas"] += 1

    stats = []
    for topico, bucket in totals.items():
        accuracy_pct = round((bucket["n_certas"] / bucket["n_questions"]) * 100, 1)
        dominado = (
            accuracy_pct >= MASTERY_THRESHOLD_PCT
            and bucket["n_questions"] >= MIN_QUESTIONS_FOR_MASTERY
        )
        stats.append(
            {
                "topico": topico,
                "n_questions": bucket["n_questions"],
                "accuracy_pct": accuracy_pct,
                "status": "dominado" if dominado else "pendente",
            }
        )
    stats.sort(key=lambda s: s["accuracy_pct"])
    return stats


def topic_stats(professor_id: UUID, before: datetime | None = None) -> list[dict]:
    """Acerto agregado por tópico, juntando questões de todas as tentativas já respondidas.

    Cada questão tem seu próprio `topico` (atribuído pelo Claude na geração) —
    diferente do `topic` da atividade como um todo, que é só o que o usuário
    digitou (ou None) ao pedir o quiz.
    """
    return topic_stats_from(answered_activities(professor_id, before=before))


def compute_streak(activity_dates: list[date]) -> int:
    """Dias consecutivos de atividade terminando hoje ou ontem.

    Se o aluno ainda não estudou hoje mas estudou ontem, o streak continua
    "vivo" (mesma lógica do Duolingo — só quebra depois de pular um dia
    inteiro sem nenhuma atividade).
    """
    if not activity_dates:
        return 0

    unique_dates = set(activity_dates)
    today = today_local()

    anchor = today if today in unique_dates else today - timedelta(days=1)
    if anchor not in unique_dates:
        return 0

    streak = 0
    cursor = anchor
    while cursor in unique_dates:
        streak += 1
        cursor -= timedelta(days=1)
    return streak
