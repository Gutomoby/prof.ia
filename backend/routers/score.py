"""
Router de Score — agrega resultados de atividades em métricas e plano de estudos.

Endpoints:
  GET  /score/{professor_id}          resumo: streak, tópicos, evolução, metas
  GET  /score/{professor_id}/plano    último plano de estudos gerado (ou null)
  POST /score/{professor_id}/plano    gera um plano de estudos novo (Claude)
"""

import json
import re
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, HTTPException

from services.claude import MODEL_HAIKU, NOTACAO_MATEMATICA, generate_study_plan
from services.rag import search_chunks
from services.scoring import answered_activities, compute_streak, to_local_date, topic_stats
from services.supabase_client import get_supabase

router = APIRouter(prefix="/score", tags=["score"])


def _get_professor(professor_id: UUID) -> dict:
    sb = get_supabase()
    res = (
        sb.table("professors")
        .select("id, discipline, system_prompt, exam_dates")
        .eq("id", str(professor_id))
        .limit(1)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Professor não encontrado")
    return res.data[0]


# ---------------------------------------------------------------------------
# Resumo (streak, tópicos, evolução, metas)
# ---------------------------------------------------------------------------


@router.get("/{professor_id}")
def get_score_summary(professor_id: UUID):
    professor = _get_professor(professor_id)
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    activities = answered_activities(professor_id)
    activity_dates = [to_local_date(a["created_at"]) for a in activities]
    score_trend = [
        {"data": a["created_at"], "score_pct": a["score_pct"]} for a in activities
    ]

    week_activities = [a for a in activities if datetime.fromisoformat(a["created_at"]) >= week_ago]
    weekly = {
        "quizzes_respondidos": len(week_activities),
        "media_score_pct": (
            round(sum(a["score_pct"] for a in week_activities) / len(week_activities), 1)
            if week_activities
            else None
        ),
    }

    topics_now = topic_stats(professor_id)
    topics_month_ago = topic_stats(professor_id, before=month_ago)
    dominados_antes = {t["topico"] for t in topics_month_ago if t["status"] == "dominado"}
    dominados_agora = [t for t in topics_now if t["status"] == "dominado"]
    novos_dominados_mes = [t for t in dominados_agora if t["topico"] not in dominados_antes]
    monthly = {
        "topicos_dominados": len(novos_dominados_mes),
        "topicos_totais": len(dominados_agora),
    }

    # Calcula domínio baseado em módulos da trilha
    sb = get_supabase()
    modules_res = (
        sb.table("modules")
        .select("id")
        .eq("professor_id", str(professor_id))
        .execute()
    )
    modules = modules_res.data or []

    if modules:
        # Para cada módulo, busca o melhor score
        dominados = 0
        for module in modules:
            quiz_res = (
                sb.table("activity_results")
                .select("score_pct")
                .eq("professor_id", str(professor_id))
                .eq("module_id", module["id"])
                .not_.is_("score_pct", "null")
                .order("score_pct", desc=True)
                .limit(1)
                .execute()
            )
            if quiz_res.data and quiz_res.data[0]["score_pct"] >= 80:
                dominados += 1
        overall_mastery_pct = round((dominados / len(modules)) * 100, 1)
    else:
        overall_mastery_pct = 0.0

    return {
        "streak_days": compute_streak(activity_dates),
        "topics": topics_now,
        "score_trend": score_trend,
        "weekly": weekly,
        "monthly": monthly,
        "overall_mastery_pct": overall_mastery_pct,
        "exam_dates": professor["exam_dates"],
    }


# ---------------------------------------------------------------------------
# Plano de estudos
# ---------------------------------------------------------------------------

# Backslash que não inicia um escape JSON válido (caso típico: LaTeX "\ell",
# "\cdot"...). Dobrado, vira um escape válido que preserva o LaTeX original.
_INVALID_JSON_ESCAPE = re.compile(r'\\(?!["\\/bfnrtu])')


def _coerce_str_list(value) -> list[str]:
    """Garante list[str] para os campos de lista do plano.

    O tool-forcing normalmente devolve arrays, mas o modelo às vezes entrega a
    lista SERIALIZADA numa string ("[\"a\", \"b\"]") — foi exatamente o que
    quebrou a tela de Início com "prioridades.slice(...).map is not a function".
    Pior: com LaTeX no meio, a string nem sempre é JSON válido (escapes tipo
    \\e), então o parse tenta também a versão com escapes corrigidos.
    """
    if isinstance(value, str):
        parsed = None
        for candidate in (value, _INVALID_JSON_ESCAPE.sub(r"\\\\", value)):
            try:
                parsed = json.loads(candidate)
                break
            except ValueError:
                continue
        if isinstance(parsed, list):
            value = parsed
        else:
            value = [value] if value.strip() else []
    if not isinstance(value, list):
        return []
    return [str(item) for item in value if str(item).strip()]


def _normalize_plan_content(content: dict) -> dict:
    """Força o contrato de StudyPlanContent (models.py) na fronteira.

    Aplicado ao SALVAR (dado novo nunca entra torto) e ao LER (planos antigos
    que já entraram tortos não derrubam a UI).
    """
    resumo = content.get("resumo") or ""
    if isinstance(resumo, list):
        resumo = " ".join(str(x) for x in resumo)
    return {
        "resumo": str(resumo),
        "prioridades": _coerce_str_list(content.get("prioridades")),
        "semana": _coerce_str_list(content.get("semana")),
        "mes": _coerce_str_list(content.get("mes")),
    }


@router.get("/{professor_id}/plano")
def get_latest_study_plan(professor_id: UUID):
    sb = get_supabase()
    res = (
        sb.table("study_plans")
        .select("id, professor_id, content, created_at")
        .eq("professor_id", str(professor_id))
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Nenhum plano de estudos gerado ainda")

    row = res.data[0]
    row["content"] = _normalize_plan_content(row["content"] or {})
    return row


@router.post("/{professor_id}/plano")
def generate_plan(professor_id: UUID):
    professor = _get_professor(professor_id)

    topics = topic_stats(professor_id)
    pendentes = [t["topico"] for t in topics if t["status"] == "pendente"]

    query = pendentes[0] if pendentes else professor["discipline"]
    chunks = search_chunks(professor_id, query, top_k=8)
    context = "\n\n---\n\n".join(c["content"] for c in chunks) or "(nenhum material enviado ainda)"

    system_prompt = (professor["system_prompt"] or "").replace("{chunks_retrieved}", context)

    if pendentes:
        topicos_desc = f"Tópicos que o aluno ainda está com dificuldade (priorize esses): {', '.join(pendentes)}."
    elif topics:
        dominados = ", ".join(f"{t['topico']} ({t['accuracy_pct']}%)" for t in topics)
        topicos_desc = (
            f"IMPORTANTE: o aluno JÁ TEM histórico de quiz e está indo bem — domina {len(topics)} "
            f"de {len(topics)} tópicos testados até agora: {dominados}. "
            "No campo 'resumo', comece afirmando esse bom desempenho (nunca diga que ele não tem dados "
            "ou está começando). Sugira avançar para tópicos novos do material que ainda não foram "
            "cobrados em quiz, ou aprofundar o nível de dificuldade dos tópicos já dominados."
        )
    else:
        topicos_desc = (
            "O aluno ainda não respondeu nenhum quiz — sugira um plano inicial equilibrado "
            "cobrindo o material disponível, sem mencionar pontos fracos."
        )
    exam_desc = f"Datas de prova informadas pelo aluno: {professor['exam_dates']}." if professor["exam_dates"] else ""

    user_prompt = (
        f"Monte um plano de estudos para esse aluno de {professor['discipline']}. "
        f"{topicos_desc} {exam_desc} "
        f"{NOTACAO_MATEMATICA} "
        "Use a tool return_study_plan para responder."
    )

    content = _normalize_plan_content(generate_study_plan(system_prompt, user_prompt, model=MODEL_HAIKU))

    sb = get_supabase()
    insert_res = (
        sb.table("study_plans")
        .insert({"professor_id": str(professor_id), "content": content})
        .execute()
    )
    if not insert_res.data:
        raise HTTPException(status_code=500, detail="Falha ao salvar o plano gerado")
    return insert_res.data[0]
