/*
  Rota de Financeiro — porta de routers/financeiro.py.

  GET /admin/financeiro/resumo     cards de resumo: usuários, receita, custo, margem
  GET /admin/financeiro/usuarios   usuários com custo gasto
  GET /admin/financeiro/custos     custos com filtro de data
  GET /admin/financeiro/kpis       churn, LTV, uso médio
  GET /admin/financeiro/receita    receita acumulada

  Majoritariamente placeholder hoje (receita, assinantes, plano são valores
  fixos) — portado como está, sem corrigir os placeholders (fora de escopo
  da migração, ver docs/migracao-supabase.md Fase 3).
*/

import type { Router } from "../../_shared/router.ts";
import { requireAdmin } from "../../_shared/auth.ts";
import { db, selectAll } from "../../_shared/db.ts";
import { HttpError } from "../../_shared/http.ts";

function parseIntParam(valor: string | null, padrao: number, min: number, max: number): number {
  if (valor === null) return padrao;
  const n = Number(valor);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new HttpError(400, `Parâmetro fora do intervalo permitido (${min}-${max}).`);
  }
  return n;
}

const arredondar = (n: number) => Math.round(n * 100) / 100;

function mensagemErro(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

type LogCusto = { cost_usd: number; user_id: string };

export function register(router: Router): void {
  router.get("/admin/financeiro/resumo", async (ctx) => {
    await requireAdmin(ctx.req);
    const dias = parseIntParam(ctx.query.get("dias"), 30, 1, 365);

    try {
      const dataLimite = new Date(Date.now() - dias * 86400_000).toISOString();
      const custosList = await selectAll<LogCusto>((de, ate) =>
        db().from("token_logs").select("cost_usd, user_id").gte("created_at", dataLimite).range(de, ate)
      );
      const custoTotal = custosList.reduce((s, r) => s + Number(r.cost_usd ?? 0), 0);
      const usuariosAtivos = new Set(custosList.map((r) => r.user_id)).size;

      return {
        usuarios: {
          ativos: usuariosAtivos,
          inativos: Math.max(0, 5 - usuariosAtivos),
          assinantes: 0,
          total: 5,
        },
        financeiro: {
          receita_total: 0.0,
          custo_total: arredondar(custoTotal),
          margem: arredondar(-custoTotal),
          margem_pct: -100.0,
        },
        periodo_dias: dias,
      };
    } catch (e) {
      return {
        error: mensagemErro(e),
        usuarios: { ativos: 0, inativos: 0, assinantes: 0, total: 0 },
        financeiro: { receita_total: 0, custo_total: 0, margem: 0, margem_pct: 0 },
        periodo_dias: dias,
      };
    }
  });

  router.get("/admin/financeiro/usuarios", async (ctx) => {
    await requireAdmin(ctx.req);
    // plano/status aceitos por compatibilidade de query string — nunca foram
    // usados no filtro no Python original também (dead params).
    const dias = parseIntParam(ctx.query.get("dias"), 30, 1, 365);
    const limit = parseIntParam(ctx.query.get("limit"), 50, 1, 500);

    try {
      const dataLimite = new Date(Date.now() - dias * 86400_000).toISOString();
      const linhas = await selectAll<{
        user_id: string;
        cost_usd: number;
        tokens_in: number;
        tokens_out: number;
      }>((de, ate) =>
        db()
          .from("token_logs")
          .select("user_id, cost_usd, tokens_in, tokens_out")
          .gte("created_at", dataLimite)
          .range(de, ate)
      );

      const usuariosCustos = new Map<
        string,
        { user_id: string; custo_total: number; tokens_total: number; operacoes: number }
      >();
      for (const row of linhas) {
        const atual = usuariosCustos.get(row.user_id) ?? {
          user_id: row.user_id,
          custo_total: 0,
          tokens_total: 0,
          operacoes: 0,
        };
        atual.custo_total += Number(row.cost_usd ?? 0);
        atual.tokens_total += (row.tokens_in ?? 0) + (row.tokens_out ?? 0);
        atual.operacoes += 1;
        usuariosCustos.set(row.user_id, atual);
      }

      const items = [...usuariosCustos.values()]
        .sort((a, b) => b.custo_total - a.custo_total)
        .slice(0, limit)
        .map((item) => ({ ...item, custo_total: arredondar(item.custo_total) }));

      return {
        items,
        total: usuariosCustos.size,
        total_custo: arredondar(items.reduce((s, u) => s + u.custo_total, 0)),
      };
    } catch (e) {
      return { error: mensagemErro(e), items: [], total: 0, total_custo: 0 };
    }
  });

  router.get("/admin/financeiro/custos", async (ctx) => {
    await requireAdmin(ctx.req);
    const por = ctx.query.get("por") ?? "operacao";
    const dataFim = ctx.query.get("data_fim") ?? new Date().toISOString().slice(0, 10);
    const dataInicio =
      ctx.query.get("data_inicio") ?? new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);

    try {
      const linhas = await selectAll<{
        operation: string | null;
        model: string | null;
        cost_usd: number;
        created_at: string;
      }>((de, ate) =>
        db()
          .from("token_logs")
          .select("operation, model, cost_usd, created_at")
          .gte("created_at", `${dataInicio}T00:00:00`)
          .lte("created_at", `${dataFim}T23:59:59`)
          .range(de, ate)
      );

      const agregado = new Map<string, number>();
      for (const row of linhas) {
        let chave: string;
        if (por === "operacao") chave = row.operation ?? "unknown";
        else if (por === "modelo") chave = row.model ?? "unknown";
        else if (por === "dia") chave = row.created_at.slice(0, 10);
        else chave = row.operation ?? "unknown";

        agregado.set(chave, (agregado.get(chave) ?? 0) + Number(row.cost_usd ?? 0));
      }

      const items = [...agregado.entries()]
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([categoria, custo]) => ({ categoria, custo: arredondar(custo) }));

      return {
        items,
        total_custo: arredondar([...agregado.values()].reduce((s, v) => s + v, 0)),
        agrupado_por: por,
        data_inicio: dataInicio,
        data_fim: dataFim,
      };
    } catch (e) {
      return { error: mensagemErro(e), items: [], total_custo: 0, agrupado_por: por };
    }
  });

  router.get("/admin/financeiro/kpis", async (ctx) => {
    await requireAdmin(ctx.req);
    const dias = parseIntParam(ctx.query.get("dias"), 30, 1, 365);

    try {
      const dataLimite = new Date(Date.now() - dias * 86400_000).toISOString();
      const dados = await selectAll<{
        user_id: string;
        tokens_in: number;
        tokens_out: number;
        cost_usd: number;
      }>((de, ate) =>
        db()
          .from("token_logs")
          .select("user_id, tokens_in, tokens_out, cost_usd")
          .gte("created_at", dataLimite)
          .range(de, ate)
      );

      const usuariosAtivos = new Set(dados.map((r) => r.user_id)).size;
      const totalTokens = dados.reduce((s, r) => s + (r.tokens_in ?? 0) + (r.tokens_out ?? 0), 0);
      const custoTotal = dados.reduce((s, r) => s + Number(r.cost_usd ?? 0), 0);

      const usoMedio = usuariosAtivos > 0 ? totalTokens / usuariosAtivos : 0;
      const custoMedio = usuariosAtivos > 0 ? custoTotal / usuariosAtivos : 0;

      return {
        usuarios_ativos: usuariosAtivos,
        churn_rate_pct: 5.0,
        ltv: arredondar(custoMedio * 3),
        uso_medio_tokens: Math.floor(usoMedio),
        custo_mensal: arredondar(custoTotal),
        receita_mensal: 0.0,
        financiadores: 0,
        custo_medio_usuario: arredondar(custoMedio),
      };
    } catch (e) {
      return {
        error: mensagemErro(e),
        usuarios_ativos: 0,
        churn_rate_pct: 0,
        ltv: 0,
        uso_medio_tokens: 0,
        custo_mensal: 0,
        receita_mensal: 0,
        financiadores: 0,
        custo_medio_usuario: 0,
      };
    }
  });

  router.get("/admin/financeiro/receita", async (ctx) => {
    await requireAdmin(ctx.req);
    const dataFim = ctx.query.get("data_fim") ?? new Date().toISOString().slice(0, 10);
    const dataInicio =
      ctx.query.get("data_inicio") ?? new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);

    // 100% placeholder — sem tabela de assinatura ainda, nunca tocou o banco
    // no Python original também.
    return {
      receita_total: 0.0,
      receita_media_usuario: 0.0,
      assinantes: 0,
      data_inicio: dataInicio,
      data_fim: dataFim,
      planos: {
        basico: { preco: 39.9, quantidade: 0 },
        pro: { preco: 89.9, quantidade: 0 },
        kango: { preco: 129.9, quantidade: 0 },
      },
    };
  });
}
