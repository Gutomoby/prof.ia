/*
  Rota de Assinaturas — painel admin, v1 sem checkout/webhook.

  GET   /admin/assinaturas            lista usuários + plano atual (se houver)
  PATCH /admin/assinaturas/:userId    admin atribui/edita o plano de um usuário

  Cobrança acontece FORA do app nesta v1 (Pix/Mercado Pago direto) — o admin
  só registra aqui o que já foi cobrado. Sem tabela de pagamento, sem
  webhook, sem enforcement de plano (isso é só visibilidade + atribuição
  manual). Ver docs/migracao-supabase.md se essa rota crescer depois.
*/

import type { Router } from "../../_shared/router.ts";
import { requireAdmin } from "../../_shared/auth.ts";
import { db, selectAll } from "../../_shared/db.ts";
import { HttpError } from "../../_shared/http.ts";
import { PLAN_IDS, PLAN_PRICES, isPlanId } from "../../_shared/planos.ts";

function parseIntParam(valor: string | null, padrao: number, min: number, max: number): number {
  if (valor === null) return padrao;
  const n = Number(valor);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new HttpError(400, `Parâmetro fora do intervalo permitido (${min}-${max}).`);
  }
  return n;
}

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

type SubscriptionRow = {
  user_id: string;
  plan: string;
  status: string;
  price_brl: number;
  notes: string | null;
  period_end: string | null;
  updated_at: string;
};

export function register(router: Router): void {
  router.get("/admin/assinaturas", async (ctx) => {
    await requireAdmin(ctx.req);
    const limit = parseIntParam(ctx.query.get("limit"), 50, 1, 1000);
    const offset = parseIntParam(ctx.query.get("offset"), 0, 0, Number.MAX_SAFE_INTEGER);

    const { data: profiles, error } = await db()
      .from("profiles")
      .select("id, email, full_name")
      .order("email")
      .range(offset, offset + limit - 1);
    if (error) throw new HttpError(500, error.message);

    const assinaturas = await selectAll<SubscriptionRow>((de, ate) =>
      db().from("subscriptions").select("*").range(de, ate),
    );
    const porUsuario = new Map(assinaturas.map((a) => [a.user_id, a]));

    const items = (profiles ?? []).map((p) => {
      const assinatura = porUsuario.get(p.id as string);
      return {
        user_id: p.id,
        email: p.email,
        full_name: p.full_name,
        plan: assinatura?.plan ?? null,
        status: assinatura?.status ?? null,
        price_brl: assinatura?.price_brl ?? null,
        notes: assinatura?.notes ?? null,
        period_end: assinatura?.period_end ?? null,
        updated_at: assinatura?.updated_at ?? null,
      };
    });

    return { items, limit, offset };
  });

  router.patch("/admin/assinaturas/:userId", async (ctx) => {
    await requireAdmin(ctx.req);
    const userId = ctx.params.userId;

    const { data: perfilRows, error: erroPerfil } = await db()
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .limit(1);
    if (erroPerfil) throw new HttpError(500, erroPerfil.message);
    if (!perfilRows || !perfilRows.length) throw new HttpError(404, "Usuário não encontrado.");

    const payload = await ctx.body<{
      plan?: unknown;
      status?: unknown;
      price_brl?: unknown;
      notes?: unknown;
      period_end?: unknown;
    }>();

    if (!isPlanId(payload.plan)) {
      throw new HttpError(400, `Campo "plan" precisa ser um de: ${PLAN_IDS.join(", ")}.`);
    }
    const plan = payload.plan;

    const status = (payload.status as string | undefined) ?? "active";
    if (status !== "active" && status !== "canceled") {
      throw new HttpError(400, 'Campo "status" precisa ser "active" ou "canceled".');
    }

    let priceBrl = payload.price_brl as number | undefined;
    if (priceBrl === undefined) {
      priceBrl = PLAN_PRICES[plan];
    } else if (typeof priceBrl !== "number" || priceBrl <= 0) {
      throw new HttpError(400, 'Campo "price_brl" precisa ser um número positivo.');
    }

    const notes = (payload.notes as string | null | undefined) ?? null;

    const periodEnd = payload.period_end as string | null | undefined;
    if (periodEnd !== undefined && periodEnd !== null && !DATA_ISO.test(periodEnd)) {
      throw new HttpError(400, 'Campo "period_end" precisa ser uma data YYYY-MM-DD.');
    }

    const { data, error } = await db()
      .from("subscriptions")
      .upsert(
        {
          user_id: userId,
          plan,
          status,
          price_brl: priceBrl,
          notes,
          period_end: periodEnd ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      )
      .select();
    if (error) throw new HttpError(500, error.message);
    if (!data || !data.length) throw new HttpError(500, "Falha ao salvar a assinatura.");
    return data[0];
  });
}
