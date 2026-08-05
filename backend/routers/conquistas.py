"""
Router de Conquistas — as medalhas da tela 34.

Endpoints:
  GET /conquistas   estado das conquistas do usuário

Só leitura, e de propósito: as conquistas são derivadas do histórico a cada
chamada (ver services/achievements.py), então não há o que criar nem
atualizar. O copy de cada uma (nome, frase, ícone) mora no frontend, junto do
design; aqui só sai a verdade — se foi ganha, quando, e onde a pessoa está.
"""

from fastapi import APIRouter

from models import AchievementList
from services.achievements import conquistas_do_usuario
from services.config import settings

router = APIRouter(prefix="/conquistas", tags=["conquistas"])


@router.get("", response_model=AchievementList)
def listar_conquistas():
    items = conquistas_do_usuario(settings.MVP_USER_ID)
    return {"items": items, "ganhas": sum(1 for i in items if i["ganha"]), "total": len(items)}
