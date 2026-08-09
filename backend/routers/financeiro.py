"""
Router de Financeiro — dashboards de usuários, custos, receita e KPIs.

Endpoints para:
- Resumo: usuários (ativos/inativos/assinantes), receita, custo, margem
- Usuários com plano e status
- Custos por tipo de tarefa (quiz, chat, módulo) com filtro de data
- KPIs: Churn, LTV, uso médio, taxa de financiadores
- Receita acumulada
"""

from datetime import datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Query

from services.supabase_client import get_supabase

router = APIRouter(prefix="/admin/financeiro", tags=["financeiro"])

# Planos e preços (em centavos pra evitar float)
PLANOS = {
    "basico": 3990,      # R$39.90
    "pro": 8990,         # R$89.90
    "kango": 12990,      # R$129.90
    "free": 0,
}

PLANO_LABELS = {
    "basico": "Básico",
    "pro": "Pro",
    "kango": "Kango",
    "free": "Free",
}


@router.get("/resumo")
async def get_resumo(dias: int = Query(30, ge=1, le=365)):
    """Cards de resumo: usuários (ativos/inativos/assinantes), receita, custo, margem."""
    sb = get_supabase()

    data_limite = datetime.utcnow() - timedelta(days=dias)

    # Usuários ativos = com activity nos últimos N dias
    res_ativos = sb.rpc(
        "count_active_users",
        {"days": dias}
    ).execute()
    ativos = res_ativos.data or 0

    # Usuários inativos = com conta mas sem activity
    res_total = sb.table("auth.users").select("count", count="exact").execute()
    total_users = res_total.count or 0
    inativos = total_users - ativos

    # Assinantes (simulado por enquanto - quando tiver tabela de subscriptions)
    assinantes = 0  # TODO: contar de subscriptions table quando implementar

    # Custo total nos últimos N dias
    res_custos = sb.table("token_logs")\
        .select("cost_usd")\
        .gte("created_at", data_limite.isoformat())\
        .execute()
    custo_total = sum(row["cost_usd"] for row in res_custos.data or [])

    # Receita (por enquanto 0 se não há assinantes)
    receita_total = (assinantes * PLANOS["pro"]) / 100  # média pra demo

    # Margem
    margem = receita_total - custo_total if receita_total > 0 else 0

    return {
        "usuarios": {
            "ativos": ativos,
            "inativos": inativos,
            "assinantes": assinantes,
            "total": total_users,
        },
        "financeiro": {
            "receita_total": round(receita_total, 2),
            "custo_total": round(custo_total, 2),
            "margem": round(margem, 2),
            "margem_pct": round((margem / receita_total * 100) if receita_total > 0 else 0, 1),
        },
        "periodo_dias": dias,
    }


@router.get("/usuarios")
async def list_usuarios(
    plano: str = Query(None),  # 'free', 'basico', 'pro', 'kango'
    status: str = Query(None),  # 'ativo', 'inativo'
    dias: int = Query(30, ge=1, le=365),
    limit: int = Query(50, ge=1, le=500),
):
    """Lista usuários com plano, status, custo e tokens."""
    sb = get_supabase()

    data_limite = datetime.utcnow() - timedelta(days=dias)

    res = sb.rpc(
        "get_usuarios_financeiro",
        {
            "dias": dias,
            "limite": limit,
        }
    ).execute()

    usuarios = []
    for row in res.data or []:
        # Filtrar por status
        if status == "ativo" and row["tokens_total"] == 0:
            continue
        if status == "inativo" and row["tokens_total"] > 0:
            continue

        # Filtrar por plano
        user_plano = row.get("plano", "free")
        if plano and user_plano != plano:
            continue

        usuarios.append({
            "id": row["id"],
            "email": row["email"],
            "plano": user_plano,
            "status": "ativo" if row["tokens_total"] > 0 else "inativo",
            "tokens_mes": row["tokens_total"],
            "custo_mes": round(row["cost_usd"], 2),
            "ultima_atividade": row["last_activity"],
            "data_criacao": row["created_at"],
        })

    return {"items": usuarios, "total": len(usuarios)}


@router.get("/custos")
async def get_custos(
    data_inicio: str = Query(None),  # YYYY-MM-DD
    data_fim: str = Query(None),     # YYYY-MM-DD
    por: str = Query("operacao"),    # 'operacao', 'modelo', 'dia'
):
    """Custos com filtro de data e agrupamento."""
    sb = get_supabase()

    # Datas padrão: últimos 30 dias
    if not data_fim:
        data_fim = datetime.utcnow().date().isoformat()
    if not data_inicio:
        data_inicio = (datetime.utcnow() - timedelta(days=30)).date().isoformat()

    res = sb.table("token_logs")\
        .select("operation, model, cost_usd, created_at")\
        .gte("created_at", f"{data_inicio}T00:00:00")\
        .lte("created_at", f"{data_fim}T23:59:59")\
        .execute()

    # Agrupar por tipo solicitado
    agregado = {}
    for row in res.data or []:
        if por == "operacao":
            chave = row["operation"]
        elif por == "modelo":
            chave = row["model"]
        elif por == "dia":
            chave = row["created_at"][:10]
        else:
            chave = row["operation"]

        if chave not in agregado:
            agregado[chave] = 0
        agregado[chave] += row["cost_usd"]

    items = [{"categoria": k, "custo": round(v, 2)} for k, v in sorted(agregado.items())]

    return {
        "items": items,
        "total_custo": round(sum(agregado.values()), 2),
        "agrupado_por": por,
        "data_inicio": data_inicio,
        "data_fim": data_fim,
    }


@router.get("/kpis")
async def get_kpis(dias: int = Query(30, ge=1, le=365)):
    """KPIs: Churn, LTV, uso médio, financiadores, etc."""
    sb = get_supabase()

    data_limite = datetime.utcnow() - timedelta(days=dias)

    # Usuários ativos (com tokens nos últimos N dias)
    res_ativos = sb.table("user_usage_daily")\
        .select("user_id")\
        .gte("date", data_limite.date().isoformat())\
        .execute()
    usuarios_ativos = len(set(row["user_id"] for row in res_ativos.data or []))

    # Tokens totais
    res_tokens = sb.table("token_logs")\
        .select("tokens_in, tokens_out")\
        .gte("created_at", data_limite.isoformat())\
        .execute()
    total_tokens = sum(row["tokens_in"] + row["tokens_out"] for row in res_tokens.data or [])

    # Custo total
    res_custos = sb.table("token_logs")\
        .select("cost_usd")\
        .gte("created_at", data_limite.isoformat())\
        .execute()
    custo_total = sum(row["cost_usd"] for row in res_custos.data or [])

    # Uso médio por usuário
    uso_medio = (total_tokens / usuarios_ativos) if usuarios_ativos > 0 else 0

    # Churn (simulado: ~5% pra demo)
    churn_rate = 5.0

    # LTV (simulado: 90 dias * custo médio)
    custo_medio_usuario = (custo_total / usuarios_ativos) if usuarios_ativos > 0 else 0
    ltv = custo_medio_usuario * 3  # 3 meses média

    # Financiadores (pagam mas não usam) - por enquanto 0
    financiadores = 0

    return {
        "usuarios_ativos": usuarios_ativos,
        "churn_rate_pct": round(churn_rate, 1),
        "ltv": round(ltv, 2),
        "uso_medio_tokens": int(uso_medio),
        "custo_mensal": round(custo_total, 2),
        "receita_mensal": 0,  # Quando tiver assinantes
        "financiadores": financiadores,
        "custo_medio_usuario": round(custo_medio_usuario, 2),
    }


@router.get("/receita")
async def get_receita(
    data_inicio: str = Query(None),
    data_fim: str = Query(None),
):
    """Receita acumulada com filtro de data."""
    sb = get_supabase()

    # Datas padrão
    if not data_fim:
        data_fim = datetime.utcnow().date().isoformat()
    if not data_inicio:
        data_inicio = (datetime.utcnow() - timedelta(days=30)).date().isoformat()

    # Por enquanto receita é 0 até implementar subscriptions
    # Quando tiver, vai contar subscriptions ativas no período
    receita_total = 0
    assinantes = 0

    return {
        "receita_total": receita_total,
        "receita_media_usuario": 0,
        "assinantes": assinantes,
        "data_inicio": data_inicio,
        "data_fim": data_fim,
        "planos": {
            "basico": {"preco": 39.90, "quantidade": 0},
            "pro": {"preco": 89.90, "quantidade": 0},
            "kango": {"preco": 129.90, "quantidade": 0},
        },
    }
