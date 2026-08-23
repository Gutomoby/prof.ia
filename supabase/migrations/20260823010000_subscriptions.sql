-- Assinaturas gerenciadas manualmente pelo admin.
--
-- Nesta v1 não existe checkout nem webhook: o pagamento é coletado fora do
-- app (Pix/Mercado Pago) e o admin só registra aqui o que já foi cobrado,
-- via PATCH /admin/assinaturas/:userId.
--
-- Sem backfill de propósito: a existência da linha É o dado ("este usuário
-- já foi atribuído a um plano por um admin").

create table if not exists subscriptions (
  user_id       uuid primary key references auth.users on delete cascade,
  plan          text not null check (plan in ('basico', 'pro', 'kango')),
  status        text not null default 'active' check (status in ('active', 'canceled')),
  price_brl     numeric(10,2) not null,
  notes         text,
  period_end    date,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

alter table subscriptions enable row level security;

drop policy if exists "user sees own subscription" on subscriptions;
create policy "user sees own subscription" on subscriptions
  for select
  using (auth.uid() = user_id);
