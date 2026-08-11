"""
Router de Financeiro — dashboards de usuários, custos, receita e KPIs.
"""

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query

from services.auth import require_admin

from services.supabase_client import get_supabase

# Custo, receita e uso por usuário: só admin. Sem a dependency abaixo
# qualquer pessoa logada — ou qualquer request direto ao Railway — lia tudo.
router = APIRouter(
    prefix="/admin/financeiro",
    tags=["financeiro"],
    dependencies=[Depends(require_admin)],
)

PLANOS = {
    "basico": 3990,
    "pro": 8990,
    "kango": 12990,
    "free": 0,
}

# O PostgREST devolve no máximo 1000 linhas por requisição e não sinaliza que
# cortou. Num painel de custo isso é pior que um erro: a conta simplesmente
# fica menor do que a real, sem nada indicando que faltou dado. O mesmo teto
# ja tinha feito um material inteiro desaparecer do digest da trilha
# (ver routers/modulos.py).
_PAGINA = 1000


def _todos(query_builder) -> list[dict]:
    """Executa a query paginando até o fim.

    Recebe uma função que monta a query, porque o builder do supabase-py é
    consumido a cada execute() e precisa ser remontado por página.
    """
    linhas: list[dict] = []
    inicio = 0
    while True:
        lote = query_builder().range(inicio, inicio + _PAGINA - 1).execute().data or []
        linhas.extend(lote)
        if len(lote) < _PAGINA:
            return linhas
        inicio += _PAGINA


@router.get("/resumo")
async def get_resumo(dias: int = Query(30, ge=1, le=365)):
    """Cards de resumo: usuários, receita, custo, margem."""
    try:
        sb = get_supabase()
        data_limite = datetime.utcnow() - timedelta(days=dias)

        # Custo total
        custos_list = _todos(
            lambda: sb.table("token_logs")
            .select("cost_usd, user_id")
            .gte("created_at", data_limite.isoformat())
        )
        custo_total = sum(float(row.get("cost_usd", 0)) for row in custos_list)
        usuarios_ativos = len(set(row["user_id"] for row in custos_list))

        return {
            "usuarios": {
                "ativos": usuarios_ativos,
                "inativos": max(0, 5 - usuarios_ativos),
                "assinantes": 0,
                "total": 5,
            },
            "financeiro": {
                "receita_total": 0.0,
                "custo_total": round(custo_total, 2),
                "margem": round(-custo_total, 2),
                "margem_pct": -100.0,
            },
            "periodo_dias": dias,
        }
    except Exception as e:
        return {
            "error": str(e),
            "usuarios": {"ativos": 0, "inativos": 0, "assinantes": 0, "total": 0},
            "financeiro": {"receita_total": 0, "custo_total": 0, "margem": 0, "margem_pct": 0},
            "periodo_dias": dias,
        }


@router.get("/usuarios")
async def list_usuarios(
    plano: str = Query(None),
    status: str = Query(None),
    dias: int = Query(30, ge=1, le=365),
    limit: int = Query(50, ge=1, le=500),
):
    """Lista usuários com custo gasto."""
    try:
        sb = get_supabase()
        data_limite = datetime.utcnow() - timedelta(days=dias)

        # Busca logs de token por usuário
        linhas = _todos(
            lambda: sb.table("token_logs")
            .select("user_id, cost_usd, tokens_in, tokens_out")
            .gte("created_at", data_limite.isoformat())
        )

        # Agrega por usuário
        usuarios_custos = {}
        for row in linhas:
            uid = row["user_id"]
            if uid not in usuarios_custos:
                usuarios_custos[uid] = {
                    "user_id": uid,
                    "custo_total": 0.0,
                    "tokens_total": 0,
                    "operacoes": 0,
                }
            usuarios_custos[uid]["custo_total"] += float(row.get("cost_usd", 0))
            usuarios_custos[uid]["tokens_total"] += row.get("tokens_in", 0) + row.get("tokens_out", 0)
            usuarios_custos[uid]["operacoes"] += 1

        # Ordena por custo (maior primeiro) e limita
        items = sorted(
            usuarios_custos.values(),
            key=lambda x: x["custo_total"],
            reverse=True
        )[:limit]

        # Formata resultado
        for item in items:
            item["custo_total"] = round(item["custo_total"], 2)

        return {
            "items": items,
            "total": len(usuarios_custos),
            "total_custo": round(sum(u["custo_total"] for u in items), 2),
        }
    except Exception as e:
        return {
            "error": str(e),
            "items": [],
            "total": 0,
            "total_custo": 0,
        }


@router.get("/custos")
async def get_custos(
    data_inicio: str = Query(None),
    data_fim: str = Query(None),
    por: str = Query("operacao"),
):
    """Custos com filtro de data."""
    try:
        sb = get_supabase()

        if not data_fim:
            data_fim = datetime.utcnow().date().isoformat()
        if not data_inicio:
            data_inicio = (datetime.utcnow() - timedelta(days=30)).date().isoformat()

        linhas = _todos(
            lambda: sb.table("token_logs")
            .select("operation, model, cost_usd, created_at")
            .gte("created_at", f"{data_inicio}T00:00:00")
            .lte("created_at", f"{data_fim}T23:59:59")
        )

        agregado = {}
        for row in linhas:
            if por == "operacao":
                chave = row.get("operation", "unknown")
            elif por == "modelo":
                chave = row.get("model", "unknown")
            elif por == "dia":
                chave = row.get("created_at", "")[:10]
            else:
                chave = row.get("operation", "unknown")

            if chave not in agregado:
                agregado[chave] = 0
            agregado[chave] += float(row.get("cost_usd", 0))

        items = [{"categoria": k, "custo": round(v, 2)} for k, v in sorted(agregado.items())]

        return {
            "items": items,
            "total_custo": round(sum(agregado.values()), 2),
            "agrupado_por": por,
            "data_inicio": data_inicio,
            "data_fim": data_fim,
        }
    except Exception as e:
        return {
            "error": str(e),
            "items": [],
            "total_custo": 0,
            "agrupado_por": por,
        }


@router.get("/kpis")
async def get_kpis(dias: int = Query(30, ge=1, le=365)):
    """KPIs: Churn, LTV, uso médio."""
    try:
        sb = get_supabase()
        data_limite = datetime.utcnow() - timedelta(days=dias)

        dados = _todos(
            lambda: sb.table("token_logs")
            .select("user_id, tokens_in, tokens_out, cost_usd")
            .gte("created_at", data_limite.isoformat())
        )
        usuarios_ativos = len(set(row["user_id"] for row in dados))
        total_tokens = sum(row.get("tokens_in", 0) + row.get("tokens_out", 0) for row in dados)
        custo_total = sum(float(row.get("cost_usd", 0)) for row in dados)

        uso_medio = (total_tokens / usuarios_ativos) if usuarios_ativos > 0 else 0
        custo_medio = (custo_total / usuarios_ativos) if usuarios_ativos > 0 else 0

        return {
            "usuarios_ativos": usuarios_ativos,
            "churn_rate_pct": 5.0,
            "ltv": round(custo_medio * 3, 2),
            "uso_medio_tokens": int(uso_medio),
            "custo_mensal": round(custo_total, 2),
            "receita_mensal": 0.0,
            "financiadores": 0,
            "custo_medio_usuario": round(custo_medio, 2),
        }
    except Exception as e:
        return {
            "error": str(e),
            "usuarios_ativos": 0,
            "churn_rate_pct": 0,
            "ltv": 0,
            "uso_medio_tokens": 0,
            "custo_mensal": 0,
            "receita_mensal": 0,
            "financiadores": 0,
            "custo_medio_usuario": 0,
        }


@router.get("/receita")
async def get_receita(
    data_inicio: str = Query(None),
    data_fim: str = Query(None),
):
    """Receita acumulada."""
    if not data_fim:
        data_fim = datetime.utcnow().date().isoformat()
    if not data_inicio:
        data_inicio = (datetime.utcnow() - timedelta(days=30)).date().isoformat()

    return {
        "receita_total": 0.0,
        "receita_media_usuario": 0.0,
        "assinantes": 0,
        "data_inicio": data_inicio,
        "data_fim": data_fim,
        "planos": {
            "basico": {"preco": 39.90, "quantidade": 0},
            "pro": {"preco": 89.90, "quantidade": 0},
            "kango": {"preco": 129.90, "quantidade": 0},
        },
    }
