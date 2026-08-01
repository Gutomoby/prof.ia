"""
Router de Progresso — XP, nível e sequência de dias do usuário (global).

Endpoints:
  GET /progresso    estado atual da progressão

É global de propósito: sequência e nível são conceitos por pessoa, não por
matéria. O progresso por matéria continua em /score/{professor_id}.
"""

from fastapi import APIRouter

from models import UserProgress
from services.config import settings
from services.progress import get_or_create_progress, level_for_xp

router = APIRouter(prefix="/progresso", tags=["progresso"])


@router.get("", response_model=UserProgress)
def get_progress():
    row = get_or_create_progress(settings.MVP_USER_ID)
    level, xp_no_nivel, xp_do_nivel = level_for_xp(row["total_xp"])
    return {
        "total_xp": row["total_xp"],
        "level": level,
        "xp_no_nivel": xp_no_nivel,
        "xp_do_nivel": xp_do_nivel,
        "current_streak": row["current_streak"],
        "longest_streak": row["longest_streak"],
        "last_activity_date": row["last_activity_date"],
    }
