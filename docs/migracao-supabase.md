# Migração Railway → Supabase Edge Functions + fixes de conta

> Commitado no repo (não só em `~/.claude/plans/`) porque o trabalho atravessa mais de uma máquina. Ver [`CLAUDE.md`](../CLAUDE.md) para convenções de como portar cada rota.

## Status

- [x] **B1** — rota `/auth/callback` (PKCE OAuth)
- [x] **B2** — tabela `profiles` + trigger de signup (migration aplicada em produção, backfill confirmado)
- [x] **Fase 1** — `conquistas` + `progresso` (deployado, roteamento/auth testados; caminho feliz com dado real ainda não testado — ver `CLAUDE.md`)
- [x] **Fase 2** — `professores` + `calendario` (deployado, roteamento/auth testados; caminho feliz com dado real ainda não testado)
- [x] **Fase 3** — `admin` + `admin/financeiro` (`list_users` agora usa `profiles`; resto portado como estava, inclusive limitações conhecidas)
- [x] **Fase 4** — `score` + `modulos` (código deployado e testado — roteamento/auth; caminho feliz depende do item pendente abaixo)
- [x] **Fase 5** — `atividades` (idem)
- [x] **Fase 6** — `documentos` (idem)
- [ ] **Pendente antes de ativar de vez** — ver seção "Falta pra ativar" abaixo
- [ ] Flip de `NEXT_PUBLIC_API_URL` + desligar Railway

Todas as 6 fases de rota estão com código escrito, portado com fidelidade linha-a-linha do Python, typechecado (`deno check`), lintado (`deno lint`) e deployado. O roteamento e a cadeia de autenticação de **todas** as rotas (Fases 1-6) foram confirmados via JWT sem sessão real (ver seção Verificação). O que falta é exclusivamente o caminho que depende de IA/RAG rodar com dado de verdade — ver abaixo.

## Falta pra ativar (bloqueios reais, não decisões de arquitetura)

1. ~~`GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `ADMIN_USER_IDS` como secrets da Edge Function~~ — ✅ **feito em 2026-08-22**, confirmado via uma function de diagnóstico temporária (deployada, checada, neutralizada depois — nunca expôs valor, só presença). Não havia tool de "set secret" no MCP nem `supabase login` funcionando neste ambiente (não-interativo); o usuário configurou direto pelo painel do Supabase (Edge Functions → Secrets), copiando os valores do Railway.
2. **Migration de schema dos embeddings (384 → 768 dims) — tentada em 2026-08-22, revertida no mesmo dia.** Aplicada com aprovação do usuário, mas o aviso dado antes de rodar subestimou o impacto: eu disse que "degradaria temporariamente a busca RAG do Railway"; na prática, `match_chunks` passou a exigir `vector(768)` e o Railway continua gerando a query embedding localmente em 384 dims — toda chamada virou erro de dimensão incompatível, não uma degradação. Isso derrubou com 500 em produção: geração de quiz (`atividades.py`), plano de estudos (`score.py`), e upload de texto digitado (`documentos.py::upload_text`, sem rollback — ficava documento órfão sem chunks). Upload de PDF também quebrava, mas tinha rollback seguro já existente.
   - Backfill via Gemini chegou a 169/361 chunks antes de esbarrar em cota diária do free tier (`RESOURCE_EXHAUSTED`, mensagem "check your plan and billing details" — não é só limite por minuto, confirmado testando de novo depois de várias esperas).
   - **Revertido**: `chunks.embedding` de volta a `vector(384)`, `match_chunks(query_embedding vector(384), ...)` como era. O revert zera embedding de novo (não há cast 768→384), incluindo os 169 já feitos — custo é só API já gasta, não dado do usuário.
   - Reprocessamento dos 361 chunks em 384 dims feito via rota temporária `POST /_maint/reembed-384` no próprio Railway (`backend/main.py`, protegida por header `x-backfill-token`, usa o `embed_texts` local de sempre — sem cota, sem API externa). Removida depois de confirmar `restantes: 0`.
   - **Retomada em 22/08, mesmo dia**: usuário avisou que o Railway sai do ar ainda hoje — não dava mais pra esperar uma janela "ideal". Schema remigrado pra `vector(768)` de novo (mesmo passo, `chunks_embedding_768_dims_final_cutover`), embeddings zerados de novo.
   - `gemini-embedding-001` esgotou cota diária do free tier **de novo** (mesmo padrão do erro sem `retryDelay`) depois de só 41/361 — não era cota por minuto, era diária, e não recuperou em ~10 min de retry pausado.
   - **Contorno que funcionou**: cota do Gemini é rastreada por modelo (visto no campo `quotaDimensions.model` do próprio erro 429). Trocada a function `reembed-chunks` pra usar `gemini-embedding-2` (versão estável, sucessora da 001, mesma família/API) em vez de `gemini-embedding-001` — bucket de cota diferente, ainda intacto. `text-embedding-004` foi tentado antes e não existe mais pra chaves novas (404). Com o modelo novo, backfill completo dos 361 chunks em ~6 tentativas pausadas (~60s entre chamadas, respeitando só o limite por minuto normal).
   - Busca validada de novo depois do backfill: self-match 1.0000, vizinhos semanticamente coerentes.
   - **Lição consolidada**: (1) migrar schema de embeddings com o Railway ainda ativo só é seguro se o Railway sair do caminho de requisição real ANTES ou imediatamente depois — não há meio-termo; (2) se a cota do modelo de embedding esgotar no meio de um backfill, verificar `GET /v1beta/models?key=...` por um modelo-irmão com cota separada antes de esperar ou pedir upgrade de billing — resolveu sem custo e sem esperar reset.

## Contexto

## Contexto

O backend hoje é FastAPI (Python) rodando no Railway, consumido pelo frontend via uma única `NEXT_PUBLIC_API_URL` (`frontend/lib/api.ts`). Já existe um começo de migração: `supabase/functions/_shared/` tem arquivos que são portas fiéis dos services Python, e `_shared/router.ts` foi desenhado deliberadamente para servir os **mesmos paths** do FastAPI — a estratégia de migração incremental já está embutida no código existente.

Em paralelo, o mapeamento do fluxo de criação de conta achou dois bugs ativos: faltava a rota `/auth/callback` (login social não gravava sessão), e não existia tabela `profiles`/trigger de signup (nome do usuário só vivia em `user_metadata`, frágil; `admin.py::list_users` tentava ler `auth.users` via PostgREST e provavelmente falhava).

Decisões já tomadas: embeddings via API externa (não manter serviço Python à parte); migração incremental rota-por-rota, Railway no ar até o fim.

## Parte B — Fixes de conta (concluída)

### B1. Rota `/auth/callback` (PKCE OAuth quebrado)

`frontend/middleware.ts` intercepta `/dashboard`, `/professor`, `/licao`, `/perfil`, `/admin`, `/comecar`, `/diagnostico`, `/login`, `/criar-conta` — **não** intercepta `/auth/*`. `SocialButtons.tsx` mandava `redirectTo: ${origin}/dashboard` direto, sem nunca trocar o `code` da URL por sessão.

- `frontend/app/auth/callback/route.ts`: lê `code` da query, `exchangeCodeForSession(code)`, redireciona pro destino (`next` da query, default `/dashboard`); em erro, redireciona pra `/login?erro=...`.
- `frontend/components/auth/SocialButtons.tsx`: `redirectTo` agora aponta para `/auth/callback?next=/dashboard`.

### B2. Tabela `profiles` + trigger `on auth.users insert`

`supabase/migrations/20260822120000_profiles_and_signup_trigger.sql`:
- `profiles` (`id uuid PK references auth.users on delete cascade`, `email text`, `full_name text`, `created_at timestamptz default now()`) + RLS `auth.uid() = id`.
- Função `handle_new_user()` (`security definer`, `set search_path = public`) insere em `profiles` **e** em `user_progress` (zeros) no mesmo evento — elimina a race condition de `get_or_create_progress`/`progressoOuCriar` para contas novas (o caminho lazy continua valendo como fallback para contas criadas antes desta migration).
- `revoke execute ... from anon, authenticated, public` + trigger `on_auth_user_created`.
- Backfill: contas existentes (inclusive a do admin) já têm `profiles`.

Isso já elimina a causa raiz do bug em `admin.py::list_users`, que a Fase 3 vai aproveitar.

## Parte A — Migração incremental para Edge Functions

### Infra comum

- `supabase/functions/api/index.ts` — entrypoint único: instancia `Router` (`_shared/router.ts`), chama um `register(router)` por domínio já migrado. Cresce por importação a cada fase, nunca é reescrito.
- Padrão por domínio: `supabase/functions/api/routes/<dominio>.ts` exporta `register(router: Router)`, usando `currentUserId`/`requireAdmin`/`getOwnedProfessor` de `_shared/auth.ts`, `db()`/`selectAll` de `_shared/db.ts`, `HttpError` de `_shared/http.ts` — mesmos paths e mesmos contratos de erro (`{"detail": "..."}"`) que o FastAPI já serve hoje.
- **Validação por fase**: deploy (CLI local `supabase functions deploy api` ou MCP `deploy_edge_function`) + chamada direta na URL da function com um JWT real, comparando com o Railway — sem tocar `NEXT_PUBLIC_API_URL` do Vercel até todas as fases estarem validadas. Só no fim, um único flip de env var troca tudo de uma vez.

### Solução de embeddings: Gemini `gemini-embedding-001`, 768 dims

> Revisado em 2026-08-22: a escolha original (OpenAI `text-embedding-3-small` @ 384 dims) foi trocada por decisão do usuário — evitar um terceiro provedor de IA quando o projeto já usa Gemini (`GEMINI_API_KEY` já existe em `backend/services/config.py`). Nota de custo: OpenAI ($0,02/1M tokens) é mais barato por token que Gemini ($0,15/1M) — a troca é por simplicidade operacional, não por custo; irrelevante em termos absolutos na escala do projeto.

Schema atual: `vector(384)` (`chunks.embedding`, RPC `match_chunks`), modelo atual `sentence-transformers/all-MiniLM-L6-v2`.

- **Modelo**: `gemini-embedding-001` (GA/estável — não o `gemini-embedding-2-preview`, multimodal e ainda preview). Recomenda oficialmente 3072/1536/768 — não 384.
- **Dimensão: subir para 768.** Exige migration adicional: `alter table chunks alter column embedding type vector(768)`, atualizar assinatura de `match_chunks`, recriar índice `ivfflat`. Sem custo extra real: reprocessar 100% dos chunks já é obrigatório de qualquer forma ao trocar de modelo.
- Criar `supabase/functions/_shared/embeddings.ts` — porta de `chunk_text`/`embed_texts`/`index_document`/`search_chunks` de `backend/services/rag.py`, chamando a API Gemini (`embedContent`, `output_dimensionality: 768`), chunking com `tiktoken` (`cl100k_base`, mesmo do Python).
- Job de backfill (script ou rota admin temporária) que pagina `chunks` via `selectAll`, reembeda em lotes de 64, `update` in-place. Pode rodar **antes** da Fase 6, de forma independente.
- Sem secret nova — reaproveita `GEMINI_API_KEY`.

### PDF extraction em Deno

PyMuPDF é nativo, não roda no Edge Runtime. Usar `npm:unpdf` (wrapper WASM do pdf.js para runtimes edge) — `extractText(pdfBuffer)` por página. Fallback: `npm:pdfjs-dist/legacy/build/pdf.mjs` direto.

- Criar `supabase/functions/_shared/pdf.ts` — porta de `backend/services/pdf.py`.
- Testar cedo com o maior PDF real do produto (caso conhecido de 600 páginas/1.4M caracteres) contra o teto de memória/tempo de uma Edge Function.

### Ordem das fases (risco crescente) — todas concluídas

1. ~~`conquistas` + `progresso`~~ — ✅ feito.
2. ~~`professores` + `calendario`~~ — ✅ feito.
3. ~~`admin` + `admin/financeiro`~~ — ✅ feito. `list_users` virou `db().from("profiles").select(...)`.
4. ~~`score` + `modulos`~~ — ✅ feito. Entrou `_shared/embeddings.ts` e `_shared/claude.ts`. `modulos` replicou a lógica sensível de paginação/amostragem de chunks linha-a-linha.
5. ~~`atividades`~~ — ✅ feito. Geração com fallback Gemini→Haiku, correção, XP/streak, `_shared/notacao.ts`, log de tokens.
6. ~~`documentos`~~ — ✅ feito. `_shared/pdf.ts` (via `npm:unpdf`, testado em runtime) + Storage + compensação/rollback replicados.

`chat` fica fora do escopo — stub vazio, nada a portar.

Detalhes de implementação de cada peça nova ficam nos próprios arquivos (`_shared/claude.ts`, `_shared/embeddings.ts`, `_shared/pdf.ts`, `_shared/notacao.ts`) — os comentários de cabeçalho de cada um linkam de volta pro Python original.

### Critério de "pronto para desligar o Railway"

- [x] Todas as fases (exceto chat) deployadas com roteamento/auth validados contra o Railway.
- [ ] `GEMINI_API_KEY` configurada como secret da function (ver "Falta pra ativar").
- [ ] Migration de schema (768 dims) aplicada + backfill de embeddings 100% concluído.
- [ ] Caminho feliz de cada fase testado com dado real (usuário logado de verdade, não só JWT sem sessão) — pendente até ter uma forma limpa de gerar sessão de teste, ou até o usuário validar manualmente.
- [ ] `NEXT_PUBLIC_API_URL` trocado no Vercel, validado em produção real por alguns dias cobrindo upload de PDF grande, geração de quiz e geração de módulos, sem regressão.
- [ ] Secrets (`ADMIN_USER_IDS`, `EXTRA_CORS_ORIGINS`) replicados na function (`GEMINI_API_KEY` já coberta acima).
- Só então desprovisionar o serviço no Railway.

## Verificação

- **Por fase (feito para as 6 fases)**: deploy + chamada direta com um JWT válido-mas-sem-sessão (a própria anon key como Bearer — passa pelo gateway `verify_jwt` do Supabase mas não corresponde a nenhum usuário real) confirma roteamento, CORS e a cadeia de autenticação sem precisar de credencial nenhuma. Não substitui testar o caminho feliz com dado real.
- **Embeddings**: após o backfill, rodar uma busca conhecida (`match_chunks`) e conferir que os resultados fazem sentido (não uma mistura de espaços vetoriais).
