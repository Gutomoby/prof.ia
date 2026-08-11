"""
Router de Calendário — visão de tempo cruzando todas as matérias.

Endpoints:
  GET    /calendario                  atividades respondidas + eventos numa janela
  POST   /calendario/eventos          marca um evento (prova, revisão, tarefa)
  DELETE /calendario/eventos/{id}     remove um evento

O passado vem de activity_results (o que o aluno realmente fez) e o futuro de
calendar_events (o que ele marcou). Provas são eventos com kind='prova' —
professors.exam_dates continua existindo como nota em texto livre e não é lido
aqui, justamente por não ser uma data confiável.
"""

from datetime import date
from uuid import UUID

from fastapi import APIRouter, HTTPException

from models import CalendarEventCreate, CalendarResponse
from services.auth import UserId
from services.progress import user_professor_ids
from services.supabase_client import get_supabase

router = APIRouter(prefix="/calendario", tags=["calendario"])


def _professors_by_id(user_id: str) -> dict[str, dict]:
    sb = get_supabase()
    res = sb.table("professors").select("id, name, discipline").eq("user_id", user_id).execute()
    return {row["id"]: row for row in (res.data or [])}


@router.get("", response_model=CalendarResponse)
def get_calendario(inicio: date, fim: date, user_id: UserId):
    """Atividades respondidas e eventos marcados entre `inicio` e `fim` (inclusive)."""
    professors = _professors_by_id(user_id)
    professor_ids = list(professors.keys())

    sb = get_supabase()

    activities: list[dict] = []
    if professor_ids:
        # `fim` é inclusive: o filtro vai até o fim do dia, por isso lt(fim + 1 dia).
        res = (
            sb.table("activity_results")
            .select("id, professor_id, topic, score_pct, created_at")
            .in_("professor_id", professor_ids)
            .not_.is_("score_pct", "null")
            .gte("created_at", inicio.isoformat())
            .lt("created_at", f"{fim.isoformat()}T23:59:59.999999+00:00")
            .order("created_at")
            .execute()
        )
        for row in res.data or []:
            professor = professors.get(row["professor_id"], {})
            activities.append(
                {
                    **row,
                    "professor_name": professor.get("name", "—"),
                    "discipline": professor.get("discipline", ""),
                }
            )

    events_res = (
        sb.table("calendar_events")
        .select("id, professor_id, title, kind, event_date")
        .eq("user_id", user_id)
        .gte("event_date", inicio.isoformat())
        .lte("event_date", fim.isoformat())
        .order("event_date")
        .execute()
    )
    events = [
        {
            **row,
            "professor_name": professors.get(row["professor_id"], {}).get("name"),
        }
        for row in (events_res.data or [])
    ]

    return {"activities": activities, "events": events}


@router.post("/eventos")
def create_evento(payload: CalendarEventCreate, user_id: UserId):

    if payload.professor_id is not None:
        if str(payload.professor_id) not in _professors_by_id(user_id):
            raise HTTPException(status_code=404, detail="Professor não encontrado")

    sb = get_supabase()
    res = (
        sb.table("calendar_events")
        .insert(
            {
                "user_id": user_id,
                "professor_id": str(payload.professor_id) if payload.professor_id else None,
                "title": payload.title,
                "kind": payload.kind,
                "event_date": payload.event_date.isoformat(),
            }
        )
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=500, detail="Falha ao criar o evento")
    return res.data[0]


@router.delete("/eventos/{event_id}")
def delete_evento(event_id: UUID, user_id: UserId):
    sb = get_supabase()
    res = (
        sb.table("calendar_events")
        .delete()
        .eq("id", str(event_id))
        .eq("user_id", user_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Evento não encontrado")
    return {"deleted": str(event_id)}
