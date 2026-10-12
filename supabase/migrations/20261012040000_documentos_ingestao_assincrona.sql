-- Ingestão assíncrona e resumível de PDFs.
--
-- Até aqui o upload era uma única requisição que esperava a indexação inteira
-- (extração + embeddings + insert). PDF grande estourava o tempo da função, e
-- qualquer falha (ex.: 429 do Gemini) apagava o documento e todos os embeddings
-- já pagos. Agora o documento tem estado, o processamento corre em segundo plano
-- e retoma de onde parou.
--
-- Migração só ADITIVA: documentos que já existem ficam 'pronto', e o código
-- antigo (que não conhece estas colunas) continua funcionando.

alter table public.documents
  add column if not exists status text not null default 'pronto'
    check (status in ('processando', 'pronto', 'erro')),
  add column if not exists chunks_total integer,
  add column if not exists chunks_done integer not null default 0,
  add column if not exists erro text,
  -- Última vez que o worker mostrou sinal de vida. Serve para detectar worker
  -- que morreu (instância do Cloud Run reciclada) e retomar.
  add column if not exists heartbeat_at timestamptz,
  -- Material rende XP uma única vez, quando fica pronto. Linhas antigas já
  -- foram creditadas no upload, por isso o padrão é true; o upload novo grava
  -- false explicitamente.
  add column if not exists xp_creditado boolean not null default true;

-- Índice único (document_id, chunk_index):
--  1) torna a gravação idempotente (upsert) — reprocessar não duplica chunk;
--  2) é o que faltava para contar/apagar chunks de UM documento sem varrer a
--     tabela inteira (a FK com on delete cascade também usa document_id).
create unique index if not exists chunks_document_chunk_idx
  on public.chunks (document_id, chunk_index);

-- Reivindica um documento para processar, de forma atômica: só um worker
-- consegue (evita dois processando o mesmo PDF e gastando cota em dobro).
-- Pode reivindicar: documento em 'erro', ou 'processando' sem sinal de vida
-- recente (worker morto) / que nunca chegou a começar (heartbeat nulo).
create or replace function public.claim_documento(p_document_id uuid, p_stale_seconds integer default 120)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  update public.documents
     set status = 'processando',
         erro = null,
         heartbeat_at = now()
   where id = p_document_id
     and (
       status = 'erro'
       or (
         status = 'processando'
         and (heartbeat_at is null
              or heartbeat_at < now() - make_interval(secs => p_stale_seconds))
       )
     )
  returning id into v_id;

  return v_id is not null;
end;
$$;

-- Só a service_role (Cloud Run / Edge Functions) chama; nunca o navegador.
revoke all on function public.claim_documento(uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_documento(uuid, integer) to service_role;
