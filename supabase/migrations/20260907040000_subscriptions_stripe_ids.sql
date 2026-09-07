-- Checkout via Stripe (trial de 7 dias nativo) precisa guardar o vínculo com o
-- Customer/Subscription do Stripe pra o webhook saber qual linha atualizar
-- quando o pagamento muda de estado. subscriptions até aqui era só registro
-- manual do admin (sem esses IDs, sem checkout automático).
alter table subscriptions
  add column stripe_customer_id text,
  add column stripe_subscription_id text;

create unique index subscriptions_stripe_customer_id_idx
  on subscriptions (stripe_customer_id)
  where stripe_customer_id is not null;
