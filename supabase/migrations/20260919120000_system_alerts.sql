-- Throttle de alertas por e-mail do sistema (ex.: crédito da Anthropic
-- baixo) — evita mandar um e-mail por chamada que falhar em sequência.
-- Só service_role toca aqui (Edge Functions e Cloud Run); RLS sem policy
-- nenhuma tranca o resto.
create table if not exists system_alerts (
  kind text primary key,
  last_sent_at timestamptz not null
);

alter table system_alerts enable row level security;
