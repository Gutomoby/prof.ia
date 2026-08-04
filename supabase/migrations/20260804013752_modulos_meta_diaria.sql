-- Kango — 004: módulos gerados por IA + dificuldade do quiz + meta diária

create table if not exists modules (
  id            uuid primary key default gen_random_uuid(),
  professor_id  uuid references professors on delete cascade not null,
  position      int not null default 0,
  name          text not null,
  description   text,
  topics        jsonb not null default '[]'::jsonb,
  created_at    timestamptz default now()
);

create index if not exists modules_professor_idx on modules (professor_id, position);

alter table activity_results
  add column if not exists module_id uuid references modules on delete set null;
alter table activity_results
  add column if not exists difficulty text
  check (difficulty in ('facil', 'medio', 'dificil'));

alter table user_progress
  add column if not exists daily_goal_xp int not null default 50;
alter table user_progress
  add column if not exists xp_today int not null default 0;
alter table user_progress
  add column if not exists xp_today_date date;

alter table modules enable row level security;

drop policy if exists "user sees own modules" on modules;
create policy "user sees own modules" on modules
  for all
  using (exists (
    select 1 from professors p
    where p.id = modules.professor_id and p.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from professors p
    where p.id = modules.professor_id and p.user_id = auth.uid()
  ));;
