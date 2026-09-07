/*
  Webhook da Stripe — confirma pagamento/trial/cancelamento e atualiza
  `subscriptions` sozinho, sem depender do admin ativar na mão.

  Function SEPARADA da `api` (não uma rota dentro dela) porque a Stripe não
  manda um JWT do Supabase no header — e a `api` exige um (verify_jwt: true
  no deploy). Aqui o deploy é com verify_jwt: false; a autenticidade de quem
  chama vem da assinatura HMAC do próprio payload (stripe.webhooks.constructEvent),
  não de um JWT.

  Configurar no painel da Stripe: Developers → Webhooks → Add endpoint,
  URL desta function, eventos: customer.subscription.created,
  customer.subscription.updated, customer.subscription.deleted.
*/
import Stripe from "npm:stripe@17";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { PLAN_PRICES, isPlanId } from "../_shared/planos.ts";

function db() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function stripeClient(): Stripe {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) throw new Error("STRIPE_SECRET_KEY não configurada no ambiente");
  return new Stripe(key, { apiVersion: "2025-02-24.acacia", httpClient: Stripe.createFetchHttpClient() });
}

async function tratarSubscription(sub: Stripe.Subscription, cancelada: boolean): Promise<void> {
  const userId = sub.metadata?.user_id;
  const plan = sub.metadata?.plan;
  if (!userId || !isPlanId(plan)) {
    console.error("Webhook Stripe: subscription sem metadata.user_id/plan válidos", sub.id);
    return;
  }

  const status = !cancelada && (sub.status === "active" || sub.status === "trialing") ? "active" : "canceled";
  const periodEnd = sub.current_period_end
    ? new Date(sub.current_period_end * 1000).toISOString().slice(0, 10)
    : null;

  const { error } = await db()
    .from("subscriptions")
    .upsert(
      {
        user_id: userId,
        plan,
        status,
        price_brl: PLAN_PRICES[plan],
        period_end: periodEnd,
        stripe_customer_id: sub.customer as string,
        stripe_subscription_id: sub.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  if (error) console.error("Webhook Stripe: falha ao atualizar subscriptions", error.message);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!secret) {
    console.error("STRIPE_WEBHOOK_SECRET não configurada no ambiente");
    return new Response("webhook não configurado", { status: 500 });
  }

  const assinatura = req.headers.get("stripe-signature");
  if (!assinatura) return new Response("assinatura ausente", { status: 400 });

  const corpo = await req.text();
  const stripe = stripeClient();

  let evento: Stripe.Event;
  try {
    evento = await stripe.webhooks.constructEventAsync(corpo, assinatura, secret);
  } catch (e) {
    console.error("Webhook Stripe: assinatura inválida", e);
    return new Response("assinatura inválida", { status: 400 });
  }

  try {
    if (evento.type === "customer.subscription.created" || evento.type === "customer.subscription.updated") {
      await tratarSubscription(evento.data.object as Stripe.Subscription, false);
    } else if (evento.type === "customer.subscription.deleted") {
      await tratarSubscription(evento.data.object as Stripe.Subscription, true);
    }
  } catch (e) {
    console.error("Webhook Stripe: falha ao processar evento", evento.type, e);
    // 200 mesmo assim: erro nosso não deve fazer a Stripe re-tentar pra sempre.
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
});
