-- Perfil do usuário + trigger de signup.
--
-- Hoje o nome só vive em auth.users.raw_user_meta_data->>'full_name' (o que o
-- signUp do client manda em options.data), nunca sincronizado com nenhuma
-- tabela — /admin/users tentava ler auth.users direto via PostgREST, que não
-- expõe o schema auth por padrão. profiles vira a fonte única de nome/e-mail.
--
-- O trigger também já cria a linha em user_progress no mesmo evento: hoje ela
-- só nasce via select->insert->select na primeira leitura de /progresso
-- (get_or_create_progress / progressoOuCriar), uma corrida non-atômica entre
-- duas requisições simultâneas. Criar aqui, com zeros, elimina a corrida sem
-- mexer nesse código — o caminho lazy continua servindo de fallback só para
-- as contas criadas antes desta migration.

create table if not exists profiles (
  id          uuid primary key references auth.users on delete cascade,
  email       text,
  full_name   text,
  created_at  timestamptz default now()
);

alter table profiles enable row level security;

drop policy if exists "user sees own profile" on profiles;
create policy "user sees own profile" on profiles
  for all
  using (auth.uid() = id)
  with check (auth.uid() = id)
;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;

  insert into user_progress (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from anon, authenticated, public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Backfill para contas criadas antes desta migration (inclusive a do admin —
-- sem isto ela não aparece em /admin/users).
insert into profiles (id, email, full_name)
select id, email, raw_user_meta_data ->> 'full_name'
from auth.users
where id not in (select id from profiles);
