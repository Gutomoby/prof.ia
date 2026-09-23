-- Recargas de crédito na Anthropic, registradas manualmente pelo admin.
--
-- A Anthropic não expõe "saldo restante" por API — só dá pra ver no
-- console.anthropic.com/settings/billing. Em vez disso, o admin anota aqui
-- toda vez que recarrega, e o painel calcula um saldo ESTIMADO (soma das
-- recargas menos soma de token_logs.cost_usd). Não é o saldo exato da
-- Anthropic, mas fica próximo — o suficiente pra avisar a tempo de recarregar.
--
-- Só service_role toca aqui (rota /admin/financeiro/creditos); RLS sem
-- policy nenhuma tranca o resto, mesmo padrão de system_alerts.
create table if not exists credit_recharges (
  id          uuid primary key default gen_random_uuid(),
  amount_usd  numeric(10,2) not null,
  note        text,
  created_at  timestamptz not null default now()
);

alter table credit_recharges enable row level security;
