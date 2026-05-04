-- =====================================================================
-- ProfessorIA — schema inicial
-- =====================================================================
-- Rode este arquivo no SQL Editor do Supabase (ou via supabase db push).
-- Cria: extensão pgvector, 5 tabelas, índice vetorial, RLS e a função
-- match_chunks() usada pelo RAG.
-- =====================================================================

-- 1) Extensão pgvector (precisa vir ANTES das tabelas que usam vector(...))
create extension if not exists vector;


-- =====================================================================
-- Tabelas
-- =====================================================================

-- Professores criados pelo usuário
create table if not exists professors (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users not null,
  name            text not null,
  discipline      text not null,
  teaching_style  text,                 -- ex.: "objetivo e direto"
  exam_dates      text,                 -- texto livre
  system_prompt   text,                 -- prompt completo montado na criação
  created_at      timestamptz default now()
);

-- Documentos e textos adicionados ao professor
create table if not exists documents (
  id            uuid primary key default gen_random_uuid(),
  professor_id  uuid references professors on delete cascade,
  name          text not null,
  type          text not null check (type in ('pdf', 'text')),
  storage_path  text,                  -- path no Supabase Storage (PDF apenas)
  raw_text      text,                  -- texto extraído ou digitado
  created_at    timestamptz default now()
);

-- Chunks com embedding (coração do RAG)
create table if not exists chunks (
  id            uuid primary key default gen_random_uuid(),
  document_id   uuid references documents on delete cascade,
  professor_id  uuid references professors on delete cascade,
  content       text not null,
  embedding     vector(384),          -- sentence-transformers/all-MiniLM-L6-v2 (local, free)
  chunk_index   int,
  created_at    timestamptz default now()
);

-- Sessões de chat
create table if not exists chat_sessions (
  id            uuid primary key default gen_random_uuid(),
  professor_id  uuid references professors on delete cascade,
  messages      jsonb default '[]'::jsonb,   -- array de {role, content, created_at}
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Atividades geradas e resultados
create table if not exists activity_results (
  id             uuid primary key default gen_random_uuid(),
  professor_id   uuid references professors on delete cascade,
  activity_type  text not null check (activity_type in ('quiz','simulado','prova','reforco')),
  topic          text,
  questions      jsonb not null,
  answers        jsonb,
  score_pct      numeric,
  time_seconds   int,
  created_at     timestamptz default now()
);


-- =====================================================================
-- Índices
-- =====================================================================

-- Busca vetorial: ivfflat com cosine distance
-- (lists=100 é bom para até ~100k chunks; ajustar depois se crescer muito)
create index if not exists chunks_embedding_idx
  on chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Buscar chunks de um professor específico antes de filtrar por similaridade
create index if not exists chunks_professor_idx on chunks (professor_id);
create index if not exists documents_professor_idx on documents (professor_id);
create index if not exists activity_results_professor_idx on activity_results (professor_id);


-- =====================================================================
-- Função RPC para o RAG: match_chunks
-- =====================================================================
-- Recebe um embedding de query + professor_id + top_k e retorna os chunks
-- mais similares (cosine). Usaremos via supabase.rpc('match_chunks', ...).
-- =====================================================================
create or replace function match_chunks (
  query_embedding vector(384),
  match_professor_id uuid,
  match_count int default 5
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  similarity float
)
language sql stable
set search_path = public, extensions   -- evita lint 0011 (search_path mutável)
as $$
  select
    c.id,
    c.document_id,
    c.content,
    1 - (c.embedding <=> query_embedding) as similarity
  from chunks c
  where c.professor_id = match_professor_id
  order by c.embedding <=> query_embedding
  limit match_count;
$$;


-- =====================================================================
-- Storage bucket "materiais" (PDFs do usuário)
-- =====================================================================
-- Bucket privado: arquivos só são acessíveis via API com chave válida.
-- O backend usa service_role e bypassa qualquer policy de storage.
insert into storage.buckets (id, name, public)
  values ('materiais', 'materiais', false)
  on conflict (id) do nothing;


-- =====================================================================
-- Row-Level Security (RLS)
-- =====================================================================
-- Cada usuário só vê e mexe nos seus próprios dados. Como documents/chunks/
-- chat_sessions/activity_results se conectam ao usuário via professor_id,
-- usamos um EXISTS contra professors para checar a posse.
-- =====================================================================

alter table professors        enable row level security;
alter table documents         enable row level security;
alter table chunks            enable row level security;
alter table chat_sessions     enable row level security;
alter table activity_results  enable row level security;

-- Professors: posse direta via user_id
drop policy if exists "user sees own professors" on professors;
create policy "user sees own professors" on professors
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Documents: posse via professor
drop policy if exists "user sees own documents" on documents;
create policy "user sees own documents" on documents
  for all
  using (exists (
    select 1 from professors p
    where p.id = documents.professor_id and p.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from professors p
    where p.id = documents.professor_id and p.user_id = auth.uid()
  ));

-- Chunks: posse via professor
drop policy if exists "user sees own chunks" on chunks;
create policy "user sees own chunks" on chunks
  for all
  using (exists (
    select 1 from professors p
    where p.id = chunks.professor_id and p.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from professors p
    where p.id = chunks.professor_id and p.user_id = auth.uid()
  ));

-- Chat sessions: posse via professor
drop policy if exists "user sees own chat_sessions" on chat_sessions;
create policy "user sees own chat_sessions" on chat_sessions
  for all
  using (exists (
    select 1 from professors p
    where p.id = chat_sessions.professor_id and p.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from professors p
    where p.id = chat_sessions.professor_id and p.user_id = auth.uid()
  ));

-- Activity results: posse via professor
drop policy if exists "user sees own activity_results" on activity_results;
create policy "user sees own activity_results" on activity_results
  for all
  using (exists (
    select 1 from professors p
    where p.id = activity_results.professor_id and p.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from professors p
    where p.id = activity_results.professor_id and p.user_id = auth.uid()
  ));
