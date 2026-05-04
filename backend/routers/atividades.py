"""
Router de Atividades — gera e corrige Quiz / Simulado / Prova / Reforço.

Endpoints:
  POST /atividades/gerar      pede ao Claude para gerar uma nova atividade
  POST /atividades/submeter   recebe as respostas, calcula score e salva resultado
  GET  /atividades            lista atividades de um professor (com filtros opcionais)
"""

from fastapi import APIRouter

router = APIRouter(prefix="/atividades", tags=["atividades"])


@router.get("")
def list_atividades():
    # TODO
    return {"items": []}
