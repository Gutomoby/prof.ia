"""
Progressão global do usuário — XP, nível e sequência de dias.

Diferente de services/scoring.py, que é sempre por professor, aqui tudo é
agregado do usuário inteiro: o XP soma o esforço em todas as matérias e a
sequência conta o dia em que ele estudou *qualquer* coisa.

Persistido em user_progress (uma linha por usuário). Como a tabela nasceu
vazia mas o histórico de atividades já existia, a primeira leitura faz
backfill do passado — ver _backfill_values().
"""

from datetime import date, datetime, timedelta, timezone

from services.scoring import (
    compute_streak,
    correct_questions,
    to_local_date,
    today_local,
    topic_stats,
)
from services.supabase_client import get_supabase

# XP por ação — regras do documento de redesenho (§5).
# Premiar a questão errada respondida é deliberado: o objetivo é recompensar
# tentativa, não acerto. Um app que só premia acerto ensina a evitar o difícil.
XP_QUESTAO_CORRETA = 5
XP_QUESTAO_ERRADA = 1
XP_ATIVIDADE_CONCLUIDA = 10
XP_MATERIAL_INDEXADO = 20
XP_TOPICO_DOMINADO = 50

# XP acumulado necessário para alcançar os níveis 2, 3, 4, 5 e 6.
LEVEL_THRESHOLDS = [250, 600, 1100, 1800, 2700]
# Depois da tabela acima, cada nível custa um valor fixo.
XP_POR_NIVEL_EXTRA = 1000


def level_for_xp(total_xp: int) -> tuple[int, int, int]:
    """(nível, XP dentro do nível, XP necessário para fechar o nível)."""
    level = 1
    prev = 0
    for threshold in LEVEL_THRESHOLDS:
        if total_xp < threshold:
            return level, total_xp - prev, threshold - prev
        level += 1
        prev = threshold

    extras = (total_xp - prev) // XP_POR_NIVEL_EXTRA
    return level + extras, total_xp - (prev + extras * XP_POR_NIVEL_EXTRA), XP_POR_NIVEL_EXTRA


# ---------------------------------------------------------------------------
# Leitura agregada do histórico
# ---------------------------------------------------------------------------


def user_professor_ids(user_id: str) -> list[str]:
    sb = get_supabase()
    res = sb.table("professors").select("id").eq("user_id", user_id).execute()
    return [row["id"] for row in (res.data or [])]


def _all_answered_activities(professor_ids: list[str]) -> list[dict]:
    """Tentativas já respondidas de todas as matérias do usuário."""
    if not professor_ids:
        return []
    sb = get_supabase()
    res = (
        sb.table("activity_results")
        .select("questions, answers, score_pct, created_at")
        .in_("professor_id", professor_ids)
        .eq("activity_type", "quiz")
        .not_.is_("score_pct", "null")
        .order("created_at")
        .execute()
    )
    return res.data or []


def _backfill_values(user_id: str) -> dict:
    """Reconstrói XP e sequência a partir do histórico que já existe no banco.

    Sem isso, ligar a progressão zeraria um usuário que já respondeu dezenas de
    quizzes. O XP de "tópico dominado" é creditado pelo domínio *atual* — não dá
    para saber em que dia cada tópico cruzou o limiar olhando só o agregado.
    """
    professor_ids = user_professor_ids(user_id)
    activities = _all_answered_activities(professor_ids)

    total_xp = 0
    for activity in activities:
        corrected, _ = correct_questions(activity["questions"], activity["answers"] or {})
        for question in corrected:
            if question["correta"]:
                total_xp += XP_QUESTAO_CORRETA
            elif question["resposta_usuario"] is not None:
                total_xp += XP_QUESTAO_ERRADA
        total_xp += XP_ATIVIDADE_CONCLUIDA

    for professor_id in professor_ids:
        dominados = [t for t in topic_stats(professor_id) if t["status"] == "dominado"]
        total_xp += len(dominados) * XP_TOPICO_DOMINADO

    if professor_ids:
        sb = get_supabase()
        docs = sb.table("documents").select("id").in_("professor_id", professor_ids).execute()
        total_xp += len(docs.data or []) * XP_MATERIAL_INDEXADO

    activity_dates = [to_local_date(a["created_at"]) for a in activities]
    streak = compute_streak(activity_dates)

    return {
        "user_id": user_id,
        "total_xp": total_xp,
        "current_streak": streak,
        "longest_streak": streak,
        "last_activity_date": max(activity_dates).isoformat() if activity_dates else None,
    }


# ---------------------------------------------------------------------------
# Leitura / escrita da linha de progresso
# ---------------------------------------------------------------------------


def _update_progress(user_id: str, patch: dict) -> dict:
    sb = get_supabase()
    res = sb.table("user_progress").update(patch).eq("user_id", user_id).execute()
    if res.data:
        return res.data[0]
    return get_or_create_progress(user_id)


def get_or_create_progress(user_id: str) -> dict:
    sb = get_supabase()
    res = sb.table("user_progress").select("*").eq("user_id", user_id).limit(1).execute()
    if res.data:
        return res.data[0]

    inserted = sb.table("user_progress").insert(_backfill_values(user_id)).execute()
    if inserted.data:
        return inserted.data[0]
    # Corrida rara (duas requisições criando ao mesmo tempo): relê a linha.
    return sb.table("user_progress").select("*").eq("user_id", user_id).limit(1).execute().data[0]


def award_xp(user_id: str, amount: int, counts_for_streak: bool = False) -> dict:
    """Credita XP e, se a ação contar como estudo do dia, atualiza a sequência.

    Só atividade concluída mexe na sequência — subir material rende XP mas não
    mantém o streak vivo, senão bastaria fazer upload para "estudar".
    """
    current = get_or_create_progress(user_id)

    patch: dict = {
        "total_xp": current["total_xp"] + amount,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    if counts_for_streak:
        today = today_local()
        last_raw = current.get("last_activity_date")
        last = date.fromisoformat(last_raw) if last_raw else None

        if last == today:
            streak = current["current_streak"]  # já estudou hoje, sequência não muda
        elif last == today - timedelta(days=1):
            streak = current["current_streak"] + 1
        else:
            streak = 1

        patch["current_streak"] = streak
        patch["longest_streak"] = max(current["longest_streak"], streak)
        patch["last_activity_date"] = today.isoformat()

    return _update_progress(user_id, patch)
