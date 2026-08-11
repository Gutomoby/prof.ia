-- Rastreamento de tokens e custo por usuário — a fonte de dados do painel
-- /admin/financeiro.
--
-- Este arquivo se chamava 005_admin_token_tracking.sql e, por não seguir a
-- convenção de timestamp das outras migrations, nunca foi aplicado: as tabelas
-- abaixo não existiam no banco. Como o insert de log em services/claude.py está
-- dentro de um try/except, cada operação de IA falhava em silêncio e o painel
-- mostrava zero desde sempre. O nome foi corrigido para a versão realmente
-- aplicada.
--
-- Três correções em relação ao conteúdo original:
--
--  1. user_usage_daily tem chave primária (user_id, date). Antes a PK era só
--     user_id, com um unique(user_id, date) ao lado — o que limita cada usuário
--     a UMA linha para sempre. O insert do segundo dia violaria a PK, e o
--     "on conflict (user_id, date)" não pega violação de PK em user_id: o
--     trigger levantaria exceção e o log daquele dia seria perdido.
--  2. professor_id aceita null — operações de IA que não pertencem a uma
--     matéria específica (plano, chat) também precisam ser contabilizadas.
--  3. As funções fixam search_path, como já foi feito em match_chunks
--     (20260504033451_fix_match_chunks_search_path.sql), e o EXECUTE da função
--     de trigger é revogado: sendo SECURITY DEFINER no schema public, o
--     PostgREST a expunha em /rest/v1/rpc/ para anon e authenticated.

create table if not exists token_logs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users not null,
  professor_id    uuid references professors,
  model           text not null check (model in ('haiku', 'sonnet', 'gemini')),
  operation       text not null check (operation in ('quiz', 'module', 'plan', 'chat', 'other')),
  tokens_in       integer not null default 0,
  tokens_out      integer not null default 0,
  cost_usd        numeric(10, 6) not null default 0,
  created_at      timestamptz default now()
);

create index if not exists token_logs_user_date_idx  on token_logs (user_id, created_at);
create index if not exists token_logs_model_idx      on token_logs (model);
create index if not exists token_logs_operation_idx  on token_logs (operation);

-- Resumo diário por usuário, mantido pelo trigger abaixo. Evita varrer
-- token_logs inteiro para desenhar o gráfico de custo por dia.
create table if not exists user_usage_daily (
  user_id          uuid references auth.users not null,
  date             date not null,
  tokens_total     integer not null default 0,
  cost_usd         numeric(10, 6) not null default 0,
  operations_count integer not null default 0,
  created_at       timestamptz default now(),
  primary key (user_id, date)
);

create index if not exists user_usage_daily_date_idx on user_usage_daily (date);

alter table token_logs       enable row level security;
alter table user_usage_daily enable row level security;

drop policy if exists "users_view_own_logs"  on token_logs;
drop policy if exists "users_view_own_usage" on user_usage_daily;
drop policy if exists "admin_insert_logs"    on token_logs;

create policy "users_view_own_logs" on token_logs
  for select using (auth.uid() = user_id or auth.jwt() ->> 'role' = 'admin');

create policy "users_view_own_usage" on user_usage_daily
  for select using (auth.uid() = user_id or auth.jwt() ->> 'role' = 'admin');

create policy "admin_insert_logs" on token_logs
  for insert with check (auth.jwt() ->> 'role' = 'admin' or auth.jwt() ->> 'app_role' = 'service');

create or replace function update_user_usage_daily()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into user_usage_daily (user_id, date, tokens_total, cost_usd, operations_count)
  values (
    new.user_id,
    (new.created_at at time zone 'UTC')::date,
    new.tokens_in + new.tokens_out,
    new.cost_usd,
    1
  )
  on conflict (user_id, date) do update set
    tokens_total     = user_usage_daily.tokens_total + excluded.tokens_total,
    cost_usd         = user_usage_daily.cost_usd + excluded.cost_usd,
    operations_count = user_usage_daily.operations_count + 1;
  return new;
end;
$$;

revoke execute on function public.update_user_usage_daily() from anon, authenticated, public;

drop trigger if exists token_logs_update_daily on token_logs;
create trigger token_logs_update_daily
  after insert on token_logs
  for each row
  execute function update_user_usage_daily();

-- Preços por 1M tokens (agosto 2026). Mantidos em sincronia com o dicionário
-- `pricing` de _estimate_cost em backend/services/claude.py.
--   Haiku 4.5:        $0.80  in / $4.00  out
--   Sonnet:           $3.00  in / $15.00 out
--   Gemini 2.0 Flash: $0.075 in / $0.30  out
create or replace function estimate_cost(
  model text,
  tokens_in integer,
  tokens_out integer
) returns numeric
language plpgsql
immutable
set search_path = public
as $$
begin
  return case model
    when 'haiku'  then (tokens_in * 0.80  + tokens_out * 4.00)  / 1000000.0
    when 'sonnet' then (tokens_in * 3.00  + tokens_out * 15.00) / 1000000.0
    when 'gemini' then (tokens_in * 0.075 + tokens_out * 0.30)  / 1000000.0
    else 0
  end;
end;
$$;
