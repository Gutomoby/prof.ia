-- Fixa o search_path da função match_chunks para evitar hijacking via objetos
-- em schemas de maior precedência (lint 0011 do Supabase Database Linter).
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
set search_path = public, extensions
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
;
