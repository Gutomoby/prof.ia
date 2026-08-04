"""
Router de Atividades — gera e corrige Quiz / Simulado / Prova / Reforço.

Por enquanto só o tipo "quiz" está implementado de ponta a ponta (geração +
correção). Os demais tipos (simulado, prova, reforco) ficam para uma fase
seguinte — o campo `activity_type` já existe no schema para não precisar
migrar depois.

Endpoints:
  POST /atividades/gerar        pede ao Claude para gerar um quiz novo
  POST /atividades/submeter     recebe as respostas, calcula score e salva
  GET  /atividades              lista atividades de um professor (histórico)
  GET  /atividades/{id}         detalhe corrigido de uma tentativa (revisitar)
"""

from uuid import UUID

from fastapi import APIRouter, HTTPException

from models import ActivityGenerateRequest, ActivitySubmitRequest
from services.claude import MODEL_HAIKU, generate_json
from services.config import settings
from services.progress import (
    XP_ATIVIDADE_CONCLUIDA,
    XP_QUESTAO_CORRETA,
    XP_QUESTAO_ERRADA,
    XP_TOPICO_DOMINADO,
    award_xp,
)
from services.rag import search_chunks
from services.scoring import correct_questions, topic_stats
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

# A dificuldade muda o ESTILO das questões, não a matéria — o material de base
# é o mesmo; o que varia é o quanto a questão exige de raciocínio.
_DIFFICULTY_INSTRUCTIONS = {
    "facil": (
        "Dificuldade FÁCIL: questões diretas de fixação, testando definições, "
        "conceitos básicos e reconhecimento. Alternativas erradas claramente distintas."
    ),
    "medio": (
        "Dificuldade MÉDIA: questões de aplicação, no nível típico de uma prova — "
        "exigem entender o conceito e aplicá-lo a um caso simples."
    ),
    "dificil": (
        "Dificuldade DIFÍCIL: questões desafiadoras que exigem raciocínio em mais "
        "de uma etapa, casos-limite e distratores plausíveis que pegam quem decorou "
        "sem entender. Sem pegadinhas de enunciado ambíguo — difícil pelo conteúdo."
    ),
}


def _get_module(module_id, professor_id) -> dict:
    sb = get_supabase()
    res = (
        sb.table("modules")
        .select("id, name, description, topics")
        .eq("id", str(module_id))
        .eq("professor_id", str(professor_id))
        .limit(1)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Módulo não encontrado")
    return res.data[0]


@router.post("/gerar")
def gerar_atividade(payload: ActivityGenerateRequest):
    if payload.activity_type != "quiz":
        raise HTTPException(
            status_code=400,
            detail="Só o tipo 'quiz' está implementado por enquanto.",
        )

    professor = _get_professor(payload.professor_id)
    difficulty = payload.difficulty or "medio"

    module = _get_module(payload.module_id, payload.professor_id) if payload.module_id else None

    if module:
        # Quiz do módulo inteiro: busca material pelos tópicos do capítulo.
        topics: list[str] = module.get("topics") or []
        query = f"{module['name']}: {', '.join(topics)}" if topics else module["name"]
        scope_desc = (
            f'cobrindo o módulo inteiro "{module["name"]}"'
            + (f" (tópicos: {', '.join(topics)})" if topics else "")
        )
        n_questoes = "8 a 10"
        topic_label = module["name"]
    else:
        query = payload.topic or professor["discipline"]
        scope_desc = (
            f'sobre o tópico "{payload.topic}"'
            if payload.topic
            else "sobre um tópico relevante do material acima"
        )
        n_questoes = "5 a 8"
        topic_label = payload.topic

    chunks = search_chunks(payload.professor_id, query, top_k=10 if module else 8)
    context = "\n\n---\n\n".join(c["content"] for c in chunks) or "(nenhum material enviado ainda)"

    system_prompt = (professor["system_prompt"] or "").replace("{chunks_retrieved}", context)

    user_prompt = (
        f"Gere um quiz de múltipla escolha com {n_questoes} questões {scope_desc}. "
        f"{_DIFFICULTY_INSTRUCTIONS[difficulty]} "
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
                "topic": topic_label,
                "questions": questions,
                "module_id": str(payload.module_id) if payload.module_id else None,
                "difficulty": difficulty,
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
        "module_id": activity.get("module_id"),
        "difficulty": activity.get("difficulty"),
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
        .select("id, professor_id, questions")
        .eq("id", str(payload.activity_id))
        .limit(1)
        .execute()
    )
    if not found.data:
        raise HTTPException(status_code=404, detail="Atividade não encontrada")

    professor_id = found.data[0]["professor_id"]
    questions: list[dict] = found.data[0]["questions"]
    corrected, score_pct = correct_questions(questions, payload.answers)

    # Snapshot antes da correção entrar no banco, para saber quais tópicos
    # *acabaram* de cruzar o limiar de domínio com essa tentativa.
    dominados_antes = {
        t["topico"] for t in topic_stats(professor_id) if t["status"] == "dominado"
    }

    sb.table("activity_results").update(
        {
            "answers": payload.answers,
            "score_pct": score_pct,
            "time_seconds": payload.time_seconds,
        }
    ).eq("id", str(payload.activity_id)).execute()

    dominados_agora = {
        t["topico"] for t in topic_stats(professor_id) if t["status"] == "dominado"
    }
    novos_dominados = sorted(dominados_agora - dominados_antes)

    xp_ganho = XP_ATIVIDADE_CONCLUIDA + len(novos_dominados) * XP_TOPICO_DOMINADO
    for question in corrected:
        if question["correta"]:
            xp_ganho += XP_QUESTAO_CORRETA
        elif question["resposta_usuario"] is not None:
            xp_ganho += XP_QUESTAO_ERRADA

    progress = award_xp(settings.MVP_USER_ID, xp_ganho, counts_for_streak=True)

    return {
        "score_pct": score_pct,
        "questions": corrected,
        "xp_ganho": xp_ganho,
        "topicos_dominados": novos_dominados,
        "current_streak": progress["current_streak"],
    }


# ---------------------------------------------------------------------------
# Histórico
# ---------------------------------------------------------------------------


@router.get("")
def list_atividades(professor_id: UUID, activity_type: str = "quiz"):
    sb = get_supabase()
    res = (
        sb.table("activity_results")
        .select("id, topic, difficulty, score_pct, time_seconds, created_at")
        .eq("professor_id", str(professor_id))
        .eq("activity_type", activity_type)
        .order("created_at", desc=True)
        .execute()
    )
    return {"items": res.data or []}


@router.get("/{activity_id}")
def get_atividade(activity_id: UUID):
    """Detalhe de uma tentativa já respondida — usado pra "revisitar" um quiz do histórico.

    O gabarito (resposta_correta/explicacao) fica salvo permanentemente em
    `questions` desde a geração, e as respostas do usuário em `answers` desde
    a submissão — então a correção completa pode ser reconstruída aqui sem
    guardar nenhum dado novo.
    """
    sb = get_supabase()
    found = (
        sb.table("activity_results")
        .select("id, topic, difficulty, questions, answers, score_pct, time_seconds, created_at")
        .eq("id", str(activity_id))
        .limit(1)
        .execute()
    )
    if not found.data:
        raise HTTPException(status_code=404, detail="Atividade não encontrada")

    row = found.data[0]
    if row["score_pct"] is None:
        raise HTTPException(status_code=400, detail="Essa atividade ainda não foi respondida")

    corrected, _ = correct_questions(row["questions"], row["answers"] or {})

    return {
        "id": row["id"],
        "topic": row["topic"],
        "difficulty": row.get("difficulty"),
        "score_pct": row["score_pct"],
        "time_seconds": row["time_seconds"],
        "created_at": row["created_at"],
        "questions": corrected,
    }
