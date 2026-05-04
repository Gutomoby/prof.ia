"""
Router de Score — agrega resultados de atividades em métricas e recomendação.

Endpoints:
  GET /score/{professor_id}             resumo (% por tópico, por tipo, evolução)
  GET /score/{professor_id}/recomendacao texto gerado pela IA com sugestão de estudo
"""

from fastapi import APIRouter

router = APIRouter(prefix="/score", tags=["score"])


@router.get("/ping")
def ping():
    return {"ok": True}
