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
from services.auth import UserId, get_owned_professor
from services.claude import NOTACAO_MATEMATICA, generate_modules
from services.notacao import normalizar_profundo
from services.supabase_client import get_supabase

router = APIRouter(prefix="/professores/{professor_id}/modulos", tags=["modulos"])

# Orçamento de texto enviado ao Claude na organização. O material completo pode
# passar disso; nesse caso amostramos chunks uniformemente — para dividir em
# capítulos basta ver a estrutura do material, não cada parágrafo.
#
# Eram 60 mil, escolhidos quando o material típico eram apostilas de algumas
# dezenas de milhares de caracteres. Com um livro de 600 páginas na matéria
# (1,4 milhão de caracteres sozinho) a amostragem passava a pegar 1 chunk a
# cada 30: o modelo via lampejos desconexos do livro e concluía, com razão do
# ponto de vista dele, que não havia assunto novo a acrescentar.
#
# 240 mil caracteres são ~60 mil tokens — folgado dentro dos 200 mil de contexto
# do Sonnet, e o custo só aparece quando a pessoa clica em "Atualizar trilha".
_MAX_DIGEST_CHARS = 240_000


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
def list_modules(professor_id: UUID, user_id: UserId):
    get_owned_professor(professor_id, user_id, "id")
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
def gerar_modules(professor_id: UUID, user_id: UserId):
    professor = get_owned_professor(professor_id, user_id, "id, name, discipline")

    digest = _material_digest(professor_id)
    if not digest:
        raise HTTPException(
            status_code=400,
            detail="Nenhum material enviado ainda — suba PDFs ou textos antes de gerar os módulos.",
        )

    # A trilha CRESCE: os módulos que já existem ficam de pé (o histórico de
    # quiz aponta para eles) e a IA só acrescenta o que ainda não está coberto.
    #
    # Isso precisa ser dito no prompt, não só no INSERT. Sem a lista do que já
    # existe, o modelo relê o material inteiro — inclusive os PDFs antigos — e
    # devolve um currículo completo de novo, que ao ser anexado duplica a
    # trilha e derruba o % de domínio (5 de 7 vira 5 de 14 sem o aluno errar
    # nada). Foi exatamente o que aconteceu em produção.
    sb = get_supabase()
    existing_res = (
        sb.table("modules")
        .select("position, name, topics")
        .eq("professor_id", str(professor_id))
        .order("position")
        .execute()
    )
    existentes = existing_res.data or []

    system_prompt = (
        f"Você é um planejador pedagógico da disciplina {professor['discipline']}. "
        "Sua tarefa é organizar o material de estudo do aluno em módulos, como os "
        "capítulos de um livro didático: em ordem pedagógica (do fundamento ao "
        "avançado), sem sobreposição entre módulos, cobrindo todo o material."
    )

    if existentes:
        ja_cobertos = "\n".join(
            f"- {m['name']}: {', '.join(m.get('topics') or []) or '(sem tópicos)'}"
            for m in existentes
        )
        instrucao = (
            "O aluno JÁ TEM uma trilha montada, listada abaixo em MÓDULOS "
            "EXISTENTES. Ela não pode ser refeita nem repetida.\n\n"
            "Compare o MATERIAL com os MÓDULOS EXISTENTES e devolva APENAS "
            "módulos NOVOS, cobrindo assuntos do material que nenhum módulo "
            "existente já cobre. Um assunto conta como coberto mesmo que o "
            "título esteja escrito de outro jeito — compare o conteúdo, não a "
            "redação.\n"
            "Se todo o material já estiver coberto, devolva uma lista vazia. "
            "É um resultado válido e esperado: significa que a trilha já dá "
            "conta do material.\n\n"
            f"MÓDULOS EXISTENTES:\n{ja_cobertos}\n"
        )
    else:
        instrucao = "Organize o material abaixo em 3 a 8 módulos.\n"

    user_prompt = (
        f"{instrucao}\n"
        "Para cada módulo devolvido dê um título curto (como capítulo de "
        "livro), uma descrição de 1-2 frases e a lista de tópicos cobertos — "
        "cada tópico específico o suficiente para virar questão de quiz. "
        f"{NOTACAO_MATEMATICA} "
        "Use a tool return_modules para responder.\n\n"
        f"MATERIAL:\n{digest}"
    )

    result = generate_modules(system_prompt, user_prompt)
    # Nome e tópicos do capítulo aparecem na trilha e no título do quiz — a
    # notação solta era visível ali antes de qualquer questão ser gerada.
    modules = normalizar_profundo(result.get("modules") or [])

    # Nenhum módulo novo é sucesso, não erro: o material já está todo coberto.
    # Devolver a trilha atual deixa a tela consistente sem um alerta falso.
    if not modules:
        if existentes:
            return list_modules(professor_id, user_id)
        raise HTTPException(status_code=502, detail="A IA não retornou nenhum módulo.")

    # Rede de segurança para o caso de o modelo repetir mesmo assim: descarta
    # nome que já existe (ignorando caixa e espaços). Barato e evita o pior caso.
    nomes_existentes = {(m["name"] or "").strip().casefold() for m in existentes}
    modules = [m for m in modules if (m.get("name") or "").strip().casefold() not in nomes_existentes]
    if not modules:
        return list_modules(professor_id, user_id)

    max_position = (existentes[-1]["position"] if existentes else -1) + 1

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

    # Devolve a trilha INTEIRA (antiga + nova), não só o que acabou de entrar —
    # a tela que chamou está desenhando a trilha completa.
    return list_modules(professor_id, user_id)
