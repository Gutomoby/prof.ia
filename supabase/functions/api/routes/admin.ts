/*
  Rota de Admin — porta de routers/admin.py.

  GET /admin/users                listagem com resumo de uso
  GET /admin/users/:id/usage      detalhe diário de um usuário
  GET /admin/metrics              resumo geral (tokens, custo, projeção)
  GET /admin/costs/trend          tendência diária de custo

  Protegida por requireAdmin em toda rota — mesma dependency de
  routers/admin.py, aplicada aqui individualmente (o router Deno não tem
  conceito de "dependency por grupo" como o FastAPI APIRouter).
*/

import type { Router } from "../../_shared/router.ts";
import { requireAdmin } from "../../_shared/auth.ts";
import { db } from "../../_shared/db.ts";
import { HttpError } from "../../_shared/http.ts";

function parseIntParam(valor: string | null, padrao: number, min: number, max: number): number {
  if (valor === null) return padrao;
  const n = Number(valor);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new HttpError(400, `Parâmetro fora do intervalo permitido (${min}-${max}).`);
  }
  return n;
}

export function register(router: Router): void {
  router.get("/admin/users", async (ctx) => {
    await requireAdmin(ctx.req);
    const limit = parseIntParam(ctx.query.get("limit"), 50, 1, 1000);
    const offset = parseIntParam(ctx.query.get("offset"), 0, 0, Number.MAX_SAFE_INTEGER);

    // O Python original tentava sb.postgrest.from_("auth.users") direto, que
    // o PostgREST não expõe por padrão — nunca funcionou de verdade (ver
    // docs/migracao-supabase.md, Fase 3). profiles existe desde a migration
    // de signup e é a fonte correta agora.
    const { data, error } = await db()
      .from("profiles")
      .select("id, email, created_at")
      .range(offset, offset + limit - 1);
    if (error) throw new HttpError(500, error.message);
    return { items: data ?? [], limit, offset };
  });

  router.get("/admin/users/:id/usage", async (ctx) => {
    await requireAdmin(ctx.req);
    const days = parseIntParam(ctx.query.get("days"), 30, 1, 90);
    const desde = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);

    const { data, error } = await db()
      .from("user_usage_daily")
      .select("*")
      .eq("user_id", ctx.params.id)
      .gte("date", desde)
      .order("date", { ascending: true });
    if (error) throw new HttpError(500, error.message);

    if (!data || !data.length) return { items: [], total_tokens: 0, total_cost_usd: 0 };

    const totalTokens = data.reduce((s, r) => s + ((r.tokens_total as number) ?? 0), 0);
    const totalCost = data.reduce((s, r) => s + Number(r.cost_usd ?? 0), 0);

    return {
      items: data,
      total_tokens: totalTokens,
      total_cost_usd: totalCost,
      avg_daily_tokens: Math.floor(totalTokens / data.length),
      avg_daily_cost: totalCost / data.length,
    };
  });

  router.get("/admin/metrics", async (ctx) => {
    await requireAdmin(ctx.req);

    const desde = new Date(Date.now() - 30 * 86400_000).toISOString();
    const { data, error } = await db()
      .from("token_logs")
      .select("tokens_in, tokens_out, cost_usd, user_id, model")
      .gte("created_at", desde);
    if (error) throw new HttpError(500, error.message);

    const logs = data ?? [];
    const totalTokensIn = logs.reduce((s, l) => s + ((l.tokens_in as number) ?? 0), 0);
    const totalTokensOut = logs.reduce((s, l) => s + ((l.tokens_out as number) ?? 0), 0);
    const totalTokens = totalTokensIn + totalTokensOut;
    const totalCost = logs.reduce((s, l) => s + Number(l.cost_usd ?? 0), 0);
    const uniqueUsers = new Set(logs.map((l) => l.user_id)).size;

    const modelCounts: Record<string, number> = {};
    const modelCosts: Record<string, number> = {};
    for (const log of logs) {
      const model = log.model as string;
      modelCounts[model] = (modelCounts[model] ?? 0) + 1;
      modelCosts[model] = (modelCosts[model] ?? 0) + Number(log.cost_usd ?? 0);
    }

    const avgCostPerUserMonth = uniqueUsers > 0 ? totalCost / uniqueUsers : 0;

    return {
      total_tokens: totalTokens,
      total_tokens_in: totalTokensIn,
      total_tokens_out: totalTokensOut,
      total_cost_usd: totalCost,
      unique_users: uniqueUsers,
      avg_cost_per_user_month: avgCostPerUserMonth,
      operations_by_model: modelCounts,
      cost_by_model: modelCosts,
      projected_annual_cost: totalCost * 12,
      projected_annual_cost_per_user: avgCostPerUserMonth * 12,
      period_days: 30,
    };
  });

  router.get("/admin/costs/trend", async (ctx) => {
    await requireAdmin(ctx.req);
    const days = parseIntParam(ctx.query.get("days"), 30, 1, 90);
    const desde = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);

    // Replica o comportamento original: o select com sum() inline não é
    // sintaxe válida de PostgREST — o próprio type-checker do supabase-js
    // confirma isso em compile-time (ParserError). Mesma limitação do
    // Python, portada como está (fora de escopo corrigir agora — ver nota
    // equivalente em financeiro.py).
    const { data, error } = await db()
      .from("user_usage_daily")
      .select("date, sum(tokens_total) as tokens, sum(cost_usd) as cost")
      .gte("date", desde)
      .order("date", { ascending: true });
    if (error) throw new HttpError(500, error.message);

    const daily = new Map<string, { tokens: number; cost: number }>();
    // deno-lint-ignore no-explicit-any
    for (const row of (data ?? []) as any[]) {
      daily.set(row.date as string, {
        tokens: (row.tokens as number) ?? 0,
        cost: Number(row.cost ?? 0),
      });
    }

    const items = [...daily.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([date, stats]) => ({ date, ...stats }));

    const valores = [...daily.values()];
    return {
      items,
      avg_daily_cost: valores.length ? valores.reduce((s, v) => s + v.cost, 0) / valores.length : 0,
      total_cost: valores.reduce((s, v) => s + v.cost, 0),
    };
  });
}
