"""
Router de Chat — conversa com o professor virtual usando RAG + Claude streaming.

Endpoints:
  POST /chat/send    envia mensagem; retorna stream SSE com a resposta da IA
  GET  /chat/sessions/{professor_id}    histórico de sessões do professor

Implementação real do streaming será no item 7 do roadmap.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/chat", tags=["chat"])


@router.get("/ping")
def ping():
    return {"ok": True}
