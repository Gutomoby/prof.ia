-- Admin: Rastreamento de tokens e custo por usuário
-- Registra cada operação de IA (quiz, módulos, plano, chat) e seu consumo

-- Preços por 1M tokens (aproximado, janeiro 2026):
-- Haiku 4.5: $0.80 in + $4.00 out
-- Sonnet 5: $3.00 in + $15.00 out
-- Gemini 2.0 Flash: $0.075 in + $0.30 out (muito mais barato!)

create table if not exists token_logs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users not null,
  professor_id    uuid references professors not null,
  model           text not null check (model in ('haiku', 'sonnet', 'gemini')),
  operation       text not null check (operation in ('quiz', 'module', 'plan', 'chat', 'other')),
  tokens_in       integer not null default 0,
  tokens_out      integer not null default 0,
  cost_usd        numeric(10, 6) not null default 0,
  created_at      timestamptz default now()
);

create index if not exists token_logs_user_date_idx on token_logs (user_id, created_at);
create index if not exists token_logs_model_idx on token_logs (model);
create index if not exists token_logs_operation_idx on token_logs (operation);

-- Vista desnormalizada: resumo diário por usuário (atualizar via trigger)
create table if not exists user_usage_daily (
  user_id         uuid primary key references auth.users,
  date            date not null,
  tokens_total    integer not null default 0,
  cost_usd        numeric(10, 6) not null default 0,
  operations_count integer not null default 0,

  created_at      timestamptz default now(),
  unique(user_id, date)
);

create index if not exists user_usage_daily_date_idx on user_usage_daily (date);

-- RLS: usuários só veem seus próprios logs, admin vê tudo
alter table token_logs enable row level security;
alter table user_usage_daily enable row level security;

create policy "users_view_own_logs" on token_logs
  for select using (auth.uid() = user_id or auth.jwt() ->> 'role' = 'admin');

create policy "users_view_own_usage" on user_usage_daily
  for select using (auth.uid() = user_id or auth.jwt() ->> 'role' = 'admin');

-- Admin pode inserir logs (backend faz isso após cada operação de IA)
create policy "admin_insert_logs" on token_logs
  for insert with check (auth.jwt() ->> 'role' = 'admin' or auth.jwt() ->> 'app_role' = 'service');

-- Trigger: atualizar resumo diário (agregação eventual)
create or replace function update_user_usage_daily()
returns trigger as $$
begin
  insert into user_usage_daily (user_id, date, tokens_total, cost_usd, operations_count)
  values (
    new.user_id,
    new.created_at::date,
    new.tokens_in + new.tokens_out,
    new.cost_usd,
    1
  )
  on conflict (user_id, date) do update set
    tokens_total = tokens_total + (new.tokens_in + new.tokens_out),
    cost_usd = cost_usd + new.cost_usd,
    operations_count = operations_count + 1;
  return new;
end;
$$ language plpgsql;

create trigger token_logs_update_daily
  after insert on token_logs
  for each row
  execute function update_user_usage_daily();

-- Função: obter custo estimado em USD de uma operação
create or replace function estimate_cost(
  model text,
  tokens_in integer,
  tokens_out integer
) returns numeric as $$
declare
  cost_in_usd numeric := 0;
  cost_out_usd numeric := 0;
begin
  -- Preços por 1M tokens
  case model
    when 'haiku' then
      cost_in_usd := (tokens_in * 0.80) / 1000000.0;
      cost_out_usd := (tokens_out * 4.00) / 1000000.0;
    when 'sonnet' then
      cost_in_usd := (tokens_in * 3.00) / 1000000.0;
      cost_out_usd := (tokens_out * 15.00) / 1000000.0;
    when 'gemini' then
      cost_in_usd := (tokens_in * 0.075) / 1000000.0;
      cost_out_usd := (tokens_out * 0.30) / 1000000.0;
  end case;

  return cost_in_usd + cost_out_usd;
end;
$$ language plpgsql immutable;
