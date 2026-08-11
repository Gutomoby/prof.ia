"""
Router de Módulos — a IA organiza o material de um professor em "capítulos".

O fluxo pensado para o aluno:
  1. sobe o material (documentos);
  2. pede a organização em módulos (POST /gerar) — Sonnet lê o material e
     devolve capítulos em ordem pedagógica, cada um com seus tópicos;
  3. clica num módulo e gera um quiz do módulo inteiro, na dificuldade que
     quiser (isso acontece em /atividades/gerar, com module_id).

Endpoints:
  GET  /professores/{professor_id}/modulos          lista com stats de tentativa
  POST /professores/{professor_id}/modulos/gerar    (re)organiza o material
"""

from uuid import UUID

from fastapi import APIRouter, HTTPException

from models import Module
from services.claude import NOTACAO_MATEMATICA, generate_modules
from services.config import settings
from services.supabase_client import get_supabase

router = APIRouter(prefix="/professores/{professor_id}/modulos", tags=["modulos"])

# Orçamento de texto enviado ao Claude na organização. O material completo
# pode passar disso; nesse caso amostramos chunks uniformemente — para dividir
# em capítulos basta ver a estrutura do material, não cada parágrafo.
_MAX_DIGEST_CHARS = 60_000


def _get_professor(professor_id: UUID) -> dict:
    sb = get_supabase()
    res = (
        sb.table("professors")
        .select("id, name, discipline")
        .eq("id", str(professor_id))
        .eq("user_id", settings.MVP_USER_ID)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Professor não encontrado")
    return res.data[0]


def _material_digest(professor_id: UUID) -> str | None:
    """Concatena o material do professor num texto só, com cabeçalho por documento."""
    sb = get_supabase()
    docs = sb.table("documents").select("id, name").eq("professor_id", str(professor_id)).execute()
    if not docs.data:
        return None
    doc_names = {d["id"]: d["name"] for d in docs.data}

    chunks_res = (
        sb.table("chunks")
        .select("document_id, chunk_index, content")
        .eq("professor_id", str(professor_id))
        .order("document_id")
        .order("chunk_index")
        .execute()
    )
    rows = chunks_res.data or []
    if not rows:
        return None

    total = sum(len(r["content"]) for r in rows)
    if total > _MAX_DIGEST_CHARS:
        stride = max(1, round(total / _MAX_DIGEST_CHARS))
        rows = rows[::stride]

    parts: list[str] = []
    last_doc = None
    for r in rows:
        if r["document_id"] != last_doc:
            parts.append(f"\n\n===== DOCUMENTO: {doc_names.get(r['document_id'], 'sem nome')} =====\n")
            last_doc = r["document_id"]
        parts.append(r["content"])
    return "\n".join(parts)


def _module_stats(professor_id: UUID) -> dict[str, dict]:
    """Tentativas e melhor score por módulo, a partir do histórico de quizzes."""
    sb = get_supabase()
    res = (
        sb.table("activity_results")
        .select("module_id, score_pct")
        .eq("professor_id", str(professor_id))
        .not_.is_("module_id", "null")
        .not_.is_("score_pct", "null")
        .execute()
    )
    stats: dict[str, dict] = {}
    for row in res.data or []:
        s = stats.setdefault(row["module_id"], {"n_tentativas": 0, "melhor_score_pct": None})
        s["n_tentativas"] += 1
        if s["melhor_score_pct"] is None or row["score_pct"] > s["melhor_score_pct"]:
            s["melhor_score_pct"] = row["score_pct"]
    return stats


def _with_stats(rows: list[dict], stats: dict[str, dict]) -> list[dict]:
    return [
        {**row, **stats.get(row["id"], {"n_tentativas": 0, "melhor_score_pct": None})}
        for row in rows
    ]


@router.get("", response_model=dict[str, list[Module]])
def list_modules(professor_id: UUID):
    _get_professor(professor_id)
    sb = get_supabase()
    res = (
        sb.table("modules")
        .select("*")
        .eq("professor_id", str(professor_id))
        .order("position")
        .execute()
    )
    rows = res.data or []
    return {"items": _with_stats(rows, _module_stats(professor_id) if rows else {})}


@router.post("/gerar", response_model=dict[str, list[Module]])
def gerar_modules(professor_id: UUID):
    professor = _get_professor(professor_id)

    digest = _material_digest(professor_id)
    if not digest:
        raise HTTPException(
            status_code=400,
            detail="Nenhum material enviado ainda — suba PDFs ou textos antes de gerar os módulos.",
        )

    system_prompt = (
        f"Você é um planejador pedagógico da disciplina {professor['discipline']}. "
        "Sua tarefa é organizar o material de estudo do aluno em módulos, como os "
        "capítulos de um livro didático: em ordem pedagógica (do fundamento ao "
        "avançado), sem sobreposição entre módulos, cobrindo todo o material."
    )
    user_prompt = (
        "Organize o material abaixo em 3 a 8 módulos. Para cada módulo dê um "
        "título curto (como capítulo de livro), uma descrição de 1-2 frases e a "
        "lista de tópicos cobertos — cada tópico específico o suficiente para "
        "virar questão de quiz. "
        f"{NOTACAO_MATEMATICA} "
        "Use a tool return_modules para responder.\n\n"
        f"MATERIAL:\n{digest}"
    )

    result = generate_modules(system_prompt, user_prompt)
    modules = result.get("modules") or []
    if not modules:
        raise HTTPException(status_code=502, detail="A IA não retornou nenhum módulo.")

    sb = get_supabase()
    # Buscar posição máxima atual pra ADICIONAR novos módulos (não deletar antigos)
    existing = (
        sb.table("modules")
        .select("position")
        .eq("professor_id", str(professor_id))
        .order("position", desc=True)
        .limit(1)
        .execute()
    )
    max_position = (existing.data[0]["position"] if existing.data else -1) + 1

    # Adicionar novos módulos mantendo a trilha anterior intacta
    inserted = (
        sb.table("modules")
        .insert(
            [
                {
                    "professor_id": str(professor_id),
                    "position": max_position + i,
                    "name": m["name"],
                    "description": m.get("description"),
                    "topics": m.get("topics") or [],
                }
                for i, m in enumerate(modules)
            ]
        )
        .execute()
    )
    if not inserted.data:
        raise HTTPException(status_code=500, detail="Falha ao salvar os módulos gerados.")

    rows = sorted(inserted.data, key=lambda r: r["position"])
    return {"items": _with_stats(rows, {})}
