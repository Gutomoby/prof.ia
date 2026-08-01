-- =====================================================================
-- ProfessorIA — 003: reconciliação do schema + calendário + progressão
-- =====================================================================
-- PARTE A reconcilia objetos que foram criados direto no painel do Supabase
-- e nunca entraram numa migration (documents.summary, summaries,
-- user_progress). Tudo com "if not exists": rodar em produção é no-op, o
-- efeito é o repo passar a descrever o banco de verdade.
--
-- PARTE B cria o que é novo: calendar_events (provas, revisões e tarefas
-- marcadas pelo usuário no calendário).
-- =====================================================================


-- =====================================================================
-- PARTE A — reconciliação (no-op em produção)
-- =====================================================================

-- Resumo gerado por IA de um documento — coluna já existente no banco.
alter table documents add column if not exists summary text;

-- Resumos avulsos por tópico.
create table if not exists summaries (
  id            uuid primary key default gen_random_uuid(),
  professor_id  uuid references professors on delete cascade,
  topic         text,
  content       text not null,
  created_at    timestamptz default now()
);

-- Progressão global do usuário (XP, nível derivado, sequência de dias).
-- Uma linha por usuário. Populada pelo backend em services/progress.py,
-- que faz backfill do histórico na primeira leitura.
create table if not exists user_progress (
  user_id             uuid primary key references auth.users,
  current_streak      int  not null default 0,
  longest_streak      int  not null default 0,
  last_activity_date  date,
  total_xp            int  not null default 0,
  updated_at          timestamptz default now()
);


-- =====================================================================
-- PARTE B — calendário
-- =====================================================================

-- Eventos marcados pelo usuário. Provas são eventos com kind='prova' —
-- professors.exam_dates (texto livre) continua existindo como nota
-- informal e não é migrado.
-- professor_id nulo = evento geral, não amarrado a uma matéria.
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


-- =====================================================================
-- Índices
-- =====================================================================

create index if not exists calendar_events_user_date_idx
  on calendar_events (user_id, event_date);
create index if not exists calendar_events_professor_idx
  on calendar_events (professor_id);
create index if not exists summaries_professor_idx
  on summaries (professor_id);
-- O calendário filtra atividades por janela de data em todas as matérias.
create index if not exists activity_results_created_at_idx
  on activity_results (created_at);


-- =====================================================================
-- Row-Level Security — mesmo padrão do 001_initial.sql
-- =====================================================================
-- summaries: posse via professor. user_progress e calendar_events: posse
-- direta via user_id.

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
  with check (auth.uid() = user_id);
