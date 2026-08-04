-- =====================================================================
-- ProfessorIA — plano de estudos (gerado por IA)
-- =====================================================================
-- Rode este arquivo no SQL Editor do Supabase, mesmo processo do
-- 001_initial.sql. Adiciona a tabela study_plans + RLS.
-- =====================================================================

create table if not exists study_plans (
  id            uuid primary key default gen_random_uuid(),
  professor_id  uuid references professors on delete cascade,
  content       jsonb not null,   -- {resumo, prioridades: [...], semana: [...], mes: [...]}
  created_at    timestamptz default now()
);

create index if not exists study_plans_professor_idx on study_plans (professor_id);

alter table study_plans enable row level security;

drop policy if exists "user sees own study_plans" on study_plans;
create policy "user sees own study_plans" on study_plans
  for all
  using (exists (
    select 1 from professors p
    where p.id = study_plans.professor_id and p.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from professors p
    where p.id = study_plans.professor_id and p.user_id = auth.uid()
  ));
