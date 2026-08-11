"""
Router de Progresso — XP, nível, sequência e meta diária do usuário (global).

Endpoints:
  GET   /progresso        estado atual da progressão
  PATCH /progresso/meta   ajusta a meta diária de XP

É global de propósito: sequência, nível e meta são conceitos por pessoa, não
por matéria. O progresso por matéria continua em /score/{professor_id}.
"""

from fastapi import APIRouter

from models import DailyGoalUpdate, UserProgress
from services.auth import UserId
from services.progress import (
    META_DIARIA_LICOES,
    get_or_create_progress,
    level_for_xp,
    licoes_hoje,
    xp_today_of,
)
from services.supabase_client import get_supabase

router = APIRouter(prefix="/progresso", tags=["progresso"])


def _serialize(row: dict) -> dict:
    level, xp_no_nivel, xp_do_nivel = level_for_xp(row["total_xp"])
    return {
        "total_xp": row["total_xp"],
        "level": level,
        "xp_no_nivel": xp_no_nivel,
        "xp_do_nivel": xp_do_nivel,
        "current_streak": row["current_streak"],
        "longest_streak": row["longest_streak"],
        "last_activity_date": row["last_activity_date"],
        "daily_goal_xp": row.get("daily_goal_xp") or 50,
        "xp_hoje": xp_today_of(row),
        # A home fala em lições; a tela de configurações, em XP. As duas metas
        # convivem e medem coisas diferentes — ver META_DIARIA_LICOES.
        "meta_licoes": META_DIARIA_LICOES,
        "licoes_hoje": licoes_hoje(row["user_id"]),
    }


@router.get("", response_model=UserProgress)
def get_progress(user_id: UserId):
    return _serialize(get_or_create_progress(user_id))


@router.patch("/meta", response_model=UserProgress)
def update_daily_goal(payload: DailyGoalUpdate, user_id: UserId):
    get_or_create_progress(user_id)  # garante que a linha existe
    sb = get_supabase()
    res = (
        sb.table("user_progress")
        .update({"daily_goal_xp": payload.daily_goal_xp})
        .eq("user_id", user_id)
        .execute()
    )
    return _serialize(res.data[0])
