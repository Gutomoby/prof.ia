/*
  Rota de Financeiro — porta de routers/financeiro.py.

  GET /admin/financeiro/resumo     cards de resumo: usuários, receita, custo, margem
  GET /admin/financeiro/usuarios   usuários com custo gasto
  GET /admin/financeiro/custos     custos com filtro de data
  GET /admin/financeiro/kpis       churn, LTV, uso médio
  GET /admin/financeiro/receita    receita acumulada

  Receita/assinantes/financiadores agora vêm de verdade da tabela
  `subscriptions` (assinatura atribuída manualmente pelo admin — ver
  api/routes/assinaturas.ts). churn_rate_pct e ltv continuam heurísticos
  (sem histórico de estado pra calcular churn real).
*/

import type { Router } from "../../_shared/router.ts";
import { requireAdmin } from "../../_shared/auth.ts";
import { db, selectAll } from "../../_shared/db.ts";
import { HttpError } from "../../_shared/http.ts";
import { PLAN_IDS, PLAN_PRICES, type PlanId } from "../../_shared/planos.ts";

function parseIntParam(valor: string | null, padrao: number, min: number, max: number): number {
  if (valor === null) return padrao;
  const n = Number(valor);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new HttpError(400, `Parâmetro fora do intervalo permitido (${min}-${max}).`);
  }
  return n;
}

const arredondar = (n: number) => Math.round(n * 100) / 100;

// Custo de IA é registrado em USD (token_logs.cost_usd, preços em
// _shared/claude.ts::_PRICING); receita de assinatura é em BRL. Sem
// converter, "margem" subtraía dólar de real como se fossem a mesma
// unidade — invisível antes porque receita_total era sempre 0.
// Aproximação fixa, não busca cotação ao vivo (fora de escopo do MVP).
const USD_PARA_BRL = 5.4;

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

      const { count: totalUsuarios, error: erroTotal } = await db()
        .from("profiles")
        .select("*", { count: "exact", head: true });
      if (erroTotal) throw new Error(erroTotal.message);

      const { data: assinaturasAtivas, error: erroAssinaturas } = await db()
        .from("subscriptions")
        .select("price_brl")
        .eq("status", "active");
      if (erroAssinaturas) throw new Error(erroAssinaturas.message);

      // Receita escalada pelo período (mrr * dias/30) — o frontend já assume
      // essa mesma escala pra projetar o "Ano" (receita_total * 365 / dias);
      // deixar receita_total como MRR fixo faria essa projeção descolar do
      // custo_total, que já é escalado por período (soma de token_logs no
      // intervalo `dias`).
      const assinantes = (assinaturasAtivas ?? []).length;
      const mrr = (assinaturasAtivas ?? []).reduce((s, r) => s + Number(r.price_brl ?? 0), 0);
      const receitaTotal = arredondar((mrr * dias) / 30);
      const custoTotalBrl = arredondar(custoTotal * USD_PARA_BRL);
      const margem = arredondar(receitaTotal - custoTotalBrl);
      const margemPct = receitaTotal > 0
        ? arredondar((margem / receitaTotal) * 100)
        : custoTotalBrl > 0 ? -100.0 : 0.0;

      return {
        usuarios: {
          ativos: usuariosAtivos,
          inativos: Math.max(0, (totalUsuarios ?? 0) - usuariosAtivos),
          assinantes,
          total: totalUsuarios ?? 0,
        },
        financeiro: {
          receita_total: receitaTotal,
          custo_total: arredondar(custoTotal),
          custo_total_brl: custoTotalBrl,
          margem,
          margem_pct: margemPct,
        },
        periodo_dias: dias,
      };
    } catch (e) {
      return {
        error: mensagemErro(e),
        usuarios: { ativos: 0, inativos: 0, assinantes: 0, total: 0 },
        financeiro: { receita_total: 0, custo_total: 0, custo_total_brl: 0, margem: 0, margem_pct: 0 },
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

      const { data: assinaturasAtivas, error: erroAssinaturas } = await db()
        .from("subscriptions")
        .select("price_brl")
        .eq("status", "active");
      if (erroAssinaturas) throw new Error(erroAssinaturas.message);
      const financiadores = (assinaturasAtivas ?? []).length;
      // MRR fixo aqui (não escalado por `dias`, diferente de resumo.receita_total)
      // — o campo se chama "mensal" e não alimenta nenhuma projeção anualizada.
      const receitaMensal = arredondar(
        (assinaturasAtivas ?? []).reduce((s, r) => s + Number(r.price_brl ?? 0), 0),
      );

      // churn_rate_pct e ltv continuam como estavam: churn real exigiria
      // histórico de cancelamento (subscriptions só guarda o estado atual),
      // fora de escopo agora. ltv já é derivado de custo real de IA, sem
      // relação com a receita nova.
      return {
        usuarios_ativos: usuariosAtivos,
        churn_rate_pct: 5.0,
        ltv: arredondar(custoMedio * 3),
        uso_medio_tokens: Math.floor(usoMedio),
        custo_mensal: arredondar(custoTotal),
        receita_mensal: receitaMensal,
        financiadores,
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

    const { data: assinaturasAtivas, error } = await db()
      .from("subscriptions")
      .select("plan, price_brl")
      .eq("status", "active");
    if (error) throw new HttpError(500, error.message);

    const rows = assinaturasAtivas ?? [];
    const diasPeriodo = Math.max(
      1,
      Math.round(
        (new Date(`${dataFim}T00:00:00`).getTime() - new Date(`${dataInicio}T00:00:00`).getTime()) / 86400_000,
      ),
    );
    const mrr = rows.reduce((s, r) => s + Number(r.price_brl ?? 0), 0);
    const receitaTotal = arredondar((mrr * diasPeriodo) / 30);
    const assinantes = rows.length;

    const planos = Object.fromEntries(
      PLAN_IDS.map((id) => [
        id,
        { preco: PLAN_PRICES[id], quantidade: rows.filter((r) => r.plan === id).length },
      ]),
    ) as Record<PlanId, { preco: number; quantidade: number }>;

    return {
      receita_total: receitaTotal,
      receita_media_usuario: assinantes > 0 ? arredondar(receitaTotal / assinantes) : 0,
      assinantes,
      data_inicio: dataInicio,
      data_fim: dataFim,
      planos,
    };
  });
}
