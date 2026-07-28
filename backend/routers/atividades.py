"""
Router de Atividades — gera e corrige Quiz / Simulado / Prova / Reforço.

Por enquanto só o tipo "quiz" está implementado de ponta a ponta (geração +
correção). Os demais tipos (simulado, prova, reforco) ficam para uma fase
seguinte — o campo `activity_type` já existe no schema para não precisar
migrar depois.

Endpoints:
  POST /atividades/gerar      pede ao Claude para gerar um quiz novo
  POST /atividades/submeter   recebe as respostas, calcula score e salva
  GET  /atividades            lista atividades de um professor (histórico)
"""

from uuid import UUID

from fastapi import APIRouter, HTTPException

from models import ActivityGenerateRequest, ActivitySubmitRequest
from services.claude import MODEL_HAIKU, generate_json
from services.rag import search_chunks
from services.supabase_client import get_supabase

router = APIRouter(prefix="/atividades", tags=["atividades"])


def _get_professor(professor_id: UUID) -> dict:
    sb = get_supabase()
    res = (
        sb.table("professors")
        .select("id, discipline, system_prompt")
        .eq("id", str(professor_id))
        .limit(1)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Professor não encontrado")
    return res.data[0]


def _strip_answers(questions: list[dict]) -> list[dict]:
    """Remove gabarito/explicação antes de mandar as questões pro frontend responder."""
    return [
        {k: v for k, v in q.items() if k not in ("resposta_correta", "explicacao")}
        for q in questions
    ]


# ---------------------------------------------------------------------------
# Geração
# ---------------------------------------------------------------------------


@router.post("/gerar")
def gerar_atividade(payload: ActivityGenerateRequest):
    if payload.activity_type != "quiz":
        raise HTTPException(
            status_code=400,
            detail="Só o tipo 'quiz' está implementado por enquanto.",
        )

    professor = _get_professor(payload.professor_id)

    query = payload.topic or professor["discipline"]
    chunks = search_chunks(payload.professor_id, query, top_k=8)
    context = "\n\n---\n\n".join(c["content"] for c in chunks) or "(nenhum material enviado ainda)"

    system_prompt = (professor["system_prompt"] or "").replace("{chunks_retrieved}", context)

    topic_desc = f'sobre o tópico "{payload.topic}"' if payload.topic else "sobre um tópico relevante do material acima"
    user_prompt = (
        f"Gere um quiz de múltipla escolha com 5 a 8 questões {topic_desc}. "
        "Cada questão precisa ter exatamente 4 alternativas, apenas uma correta. "
        "Baseie as questões prioritariamente no material de contexto do system prompt; "
        "se ele não cobrir o tópico, use conhecimento geral da matéria. "
        "Use a tool return_quiz para responder."
    )

    result = generate_json(system_prompt, user_prompt, model=MODEL_HAIKU)
    questions = result.get("questions") or []
    if not questions:
        raise HTTPException(status_code=502, detail="Claude não retornou nenhuma questão.")

    sb = get_supabase()
    insert_res = (
        sb.table("activity_results")
        .insert(
            {
                "professor_id": str(payload.professor_id),
                "activity_type": "quiz",
                "topic": payload.topic,
                "questions": questions,
            }
        )
        .execute()
    )
    if not insert_res.data:
        raise HTTPException(status_code=500, detail="Falha ao salvar a atividade gerada")
    activity = insert_res.data[0]

    return {
        "activity_id": activity["id"],
        "topic": activity["topic"],
        "questions": _strip_answers(questions),
    }


# ---------------------------------------------------------------------------
# Submissão / correção
# ---------------------------------------------------------------------------


@router.post("/submeter")
def submeter_atividade(payload: ActivitySubmitRequest):
    sb = get_supabase()
    found = (
        sb.table("activity_results")
        .select("id, questions")
        .eq("id", str(payload.activity_id))
        .limit(1)
        .execute()
    )
    if not found.data:
        raise HTTPException(status_code=404, detail="Atividade não encontrada")

    questions: list[dict] = found.data[0]["questions"]

    corrected = []
    n_certas = 0
    for idx, q in enumerate(questions):
        resposta_usuario = payload.answers.get(str(idx))
        correta = resposta_usuario == q["resposta_correta"]
        if correta:
            n_certas += 1
        corrected.append({**q, "resposta_usuario": resposta_usuario, "correta": correta})

    score_pct = round((n_certas / len(questions)) * 100, 1) if questions else 0.0

    sb.table("activity_results").update(
        {
            "answers": payload.answers,
            "score_pct": score_pct,
            "time_seconds": payload.time_seconds,
        }
    ).eq("id", str(payload.activity_id)).execute()

    return {"score_pct": score_pct, "questions": corrected}


# ---------------------------------------------------------------------------
# Histórico
# ---------------------------------------------------------------------------


@router.get("")
def list_atividades(professor_id: UUID, activity_type: str = "quiz"):
    sb = get_supabase()
    res = (
        sb.table("activity_results")
        .select("id, topic, score_pct, time_seconds, created_at")
        .eq("professor_id", str(professor_id))
        .eq("activity_type", activity_type)
        .order("created_at", desc=True)
        .execute()
    )
    return {"items": res.data or []}
