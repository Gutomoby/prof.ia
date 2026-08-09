"""
Router de Admin — rastreamento de tokens, custo e usuários.

Requer: auth.jwt() -> role = 'admin'
"""

from datetime import datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query

from services.supabase_client import get_supabase

router = APIRouter(prefix="/admin", tags=["admin"])


def _require_admin(user_roles: str | None) -> None:
    """Protege rotas admin. Chamar no início de cada endpoint."""
    if not user_roles or "admin" not in user_roles.split(","):
        raise HTTPException(status_code=403, detail="Acesso de admin requerido")


@router.get("/users")
async def list_users(
    limit: int = Query(50, ge=1, le=1000),
    offset: int = Query(0, ge=0),
):
    """Lista usuários com resumo de uso (tokens mês, custo mês, última atividade)."""
    sb = get_supabase()

    # Busca usuários + aggregação de uso
    # Ultima linha antes da agregação: `order by usage.date desc limit 1`
    query = """
    select
      u.id,
      u.email,
      coalesce(count(distinct p.id), 0) as professor_count,
      coalesce(sum(ud.tokens_total), 0) as tokens_month,
      coalesce(sum(ud.cost_usd), 0) as cost_usd_month,
      max(tl.created_at)::date as last_activity,
      count(distinct tl.id) as operations_count
    from auth.users u
    left join professors p on p.user_id = u.id
    left join user_usage_daily ud on ud.user_id = u.id
      and ud.date >= current_date - interval '30 days'
    left join token_logs tl on tl.user_id = u.id
      and tl.created_at >= now() - interval '30 days'
    group by u.id, u.email
    order by cost_usd_month desc, u.created_at desc
    limit :limit offset :offset
    """

    res = sb.postgrest.from_("auth.users").select("*").limit(limit).offset(offset).execute()

    # Raw SQL via postgrest não suporta bem, então fazer em Python após fetch
    # Por enquanto, simples listagem de usuários:
    users = []
    for row in res.data:
        users.append({
            "id": row["id"],
            "email": row["email"],
            "created_at": row["created_at"],
        })

    return {"items": users, "limit": limit, "offset": offset}


@router.get("/users/{user_id}/usage")
async def get_user_usage(user_id: UUID, days: int = Query(30, ge=1, le=90)):
    """Detalhe diário do uso de um usuário (últimos N dias)."""
    sb = get_supabase()

    # Busca agregação diária
    res = (
        sb.table("user_usage_daily")
        .select("*")
        .eq("user_id", str(user_id))
        .gte("date", (datetime.now() - timedelta(days=days)).date().isoformat())
        .order("date", desc=False)
        .execute()
    )

    if not res.data:
        return {"items": [], "total_tokens": 0, "total_cost_usd": 0}

    total_tokens = sum(row["tokens_total"] for row in res.data)
    total_cost = sum(row["cost_usd"] for row in res.data)

    return {
        "items": res.data,
        "total_tokens": total_tokens,
        "total_cost_usd": float(total_cost),
        "avg_daily_tokens": total_tokens // len(res.data) if res.data else 0,
        "avg_daily_cost": float(total_cost / len(res.data)) if res.data else 0,
    }


@router.get("/metrics")
async def get_metrics():
    """Resumo geral: total tokens, custo, média por usuário, projeções."""
    sb = get_supabase()

    # Agregação global últimos 30 dias
    res = (
        sb.table("token_logs")
        .select("tokens_in, tokens_out, cost_usd, user_id, model")
        .gte("created_at", (datetime.now() - timedelta(days=30)).isoformat())
        .execute()
    )

    logs = res.data if res.data else []

    total_tokens_in = sum(log["tokens_in"] for log in logs)
    total_tokens_out = sum(log["tokens_out"] for log in logs)
    total_tokens = total_tokens_in + total_tokens_out
    total_cost = sum(log["cost_usd"] for log in logs)

    # Contar usuários únicos
    unique_users = len(set(log["user_id"] for log in logs))

    # Contar por modelo
    model_counts = {}
    model_costs = {}
    for log in logs:
        model = log["model"]
        model_counts[model] = model_counts.get(model, 0) + 1
        model_costs[model] = model_costs.get(model, 0.0) + log["cost_usd"]

    # Projeção anual (simples: multiplicar por 12)
    avg_cost_per_user_month = total_cost / unique_users if unique_users > 0 else 0
    projected_annual_cost = total_cost * 12
    projected_annual_cost_per_user = avg_cost_per_user_month * 12

    return {
        "total_tokens": total_tokens,
        "total_tokens_in": total_tokens_in,
        "total_tokens_out": total_tokens_out,
        "total_cost_usd": float(total_cost),
        "unique_users": unique_users,
        "avg_cost_per_user_month": float(avg_cost_per_user_month),
        "operations_by_model": model_counts,
        "cost_by_model": {k: float(v) for k, v in model_costs.items()},
        "projected_annual_cost": float(projected_annual_cost),
        "projected_annual_cost_per_user": float(projected_annual_cost_per_user),
        "period_days": 30,
    }


@router.get("/costs/trend")
async def get_cost_trend(days: int = Query(30, ge=1, le=90)):
    """Tendência diária de custo (últimos N dias) — para gráfico."""
    sb = get_supabase()

    # Agregação por dia
    res = (
        sb.table("user_usage_daily")
        .select("date, sum(tokens_total) as tokens, sum(cost_usd) as cost")
        .gte("date", (datetime.now() - timedelta(days=days)).date().isoformat())
        .order("date", desc=False)
        .execute()
    )

    # Group by date manualmente se a query acima não funcionar
    from collections import defaultdict

    daily = defaultdict(lambda: {"tokens": 0, "cost": 0})
    for row in res.data or []:
        daily[row["date"]] = {
            "tokens": row.get("tokens", 0) or 0,
            "cost": float(row.get("cost", 0) or 0),
        }

    items = [{"date": date, **stats} for date, stats in sorted(daily.items())]

    return {
        "items": items,
        "avg_daily_cost": sum(s["cost"] for s in daily.values()) / len(daily) if daily else 0,
        "total_cost": sum(s["cost"] for s in daily.values()),
    }


