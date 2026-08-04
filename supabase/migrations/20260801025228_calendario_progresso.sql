-- PARTE A — reconciliação (no-op em produção)

alter table documents add column if not exists summary text;

create table if not exists summaries (
  id            uuid primary key default gen_random_uuid(),
  professor_id  uuid references professors on delete cascade,
  topic         text,
  content       text not null,
  created_at    timestamptz default now()
);

create table if not exists user_progress (
  user_id             uuid primary key references auth.users,
  current_streak      int  not null default 0,
  longest_streak      int  not null default 0,
  last_activity_date  date,
  total_xp            int  not null default 0,
  updated_at          timestamptz default now()
);

-- PARTE B — calendário

create table if not exists calendar_events (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users not null,
  professor_id  uuid references professors on delete cascade,
  title         text not null,
  kind          text not null default 'outro'
                check (kind in ('prova', 'revisao', 'tarefa', 'outro')),
  event_date    date not null,
  created_at    timestamptz default now()
);

-- Índices

create index if not exists calendar_events_user_date_idx
  on calendar_events (user_id, event_date);
create index if not exists calendar_events_professor_idx
  on calendar_events (professor_id);
create index if not exists summaries_professor_idx
  on summaries (professor_id);
create index if not exists activity_results_created_at_idx
  on activity_results (created_at);

-- RLS

alter table summaries       enable row level security;
alter table user_progress   enable row level security;
alter table calendar_events enable row level security;

drop policy if exists "user sees own summaries" on summaries;
create policy "user sees own summaries" on summaries
  for all
  using (exists (
    select 1 from professors p
    where p.id = summaries.professor_id and p.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from professors p
    where p.id = summaries.professor_id and p.user_id = auth.uid()
  ));

drop policy if exists "user sees own progress" on user_progress;
create policy "user sees own progress" on user_progress
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user sees own calendar_events" on calendar_events;
create policy "user sees own calendar_events" on calendar_events
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);;
