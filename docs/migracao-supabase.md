# Migração Railway → Supabase Edge Functions + fixes de conta

> Commitado no repo (não só em `~/.claude/plans/`) porque o trabalho atravessa mais de uma máquina. Ver [`CLAUDE.md`](../CLAUDE.md) para convenções de como portar cada rota.

## Status

- [x] **B1** — rota `/auth/callback` (PKCE OAuth)
- [x] **B2** — tabela `profiles` + trigger de signup (migration aplicada em produção, backfill confirmado)
- [x] **Fase 1** — `conquistas` + `progresso` (deployado, roteamento/auth testados; caminho feliz com dado real ainda não testado — ver `CLAUDE.md`)
- [x] **Fase 2** — `professores` + `calendario` (deployado, roteamento/auth testados; caminho feliz com dado real ainda não testado)
- [x] **Fase 3** — `admin` + `admin/financeiro` (`list_users` agora usa `profiles`; resto portado como estava, inclusive limitações conhecidas)
- [ ] Fase 4 — `score` + `modulos` (entra `_shared/embeddings.ts`, `_shared/claude.ts`)
- [ ] Fase 5 — `atividades`
- [ ] Fase 6 — `documentos` (entra `_shared/pdf.ts`)
- [ ] Flip de `NEXT_PUBLIC_API_URL` + desligar Railway

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

### Ordem das fases (risco crescente)

1. ~~`conquistas` + `progresso`~~ — ✅ feito.
2. **`professores`** + **`calendario`** — CRUD, sem dependência nova além do `SYSTEM_PROMPT_TEMPLATE` (string estática).
3. **`admin`** + **`admin/financeiro`** — `list_users` vira `db().from("profiles").select(...)`. `financeiro` é majoritariamente placeholder — portar como está.
4. **`score`** + **`modulos`** — primeiras a consumir `_shared/embeddings.ts` e um novo `_shared/claude.ts` (wrapper Anthropic/Gemini). `modulos` carrega a lógica sensível de paginação/amostragem de chunks (já teve bug de produção) — comparar digest gerado com o Python.
5. **`atividades`** — geração com fallback Gemini→Haiku, correção, XP/streak, normalização de notação matemática (`_shared/notacao.ts`), log de tokens.
6. **`documentos`** — por último: depende de `_shared/pdf.ts` + `_shared/embeddings.ts` + Storage, precisa replicar a compensação/rollback (se indexação falhar, apaga documento e arquivo do Storage).

`chat` fica fora do escopo — stub vazio, nada a portar.

### Critério de "pronto para desligar o Railway"

- Todas as fases (exceto chat) com paridade validada contra o Railway.
- Backfill de embeddings 100% concluído.
- `NEXT_PUBLIC_API_URL` trocado no Vercel, validado em produção real por alguns dias, sem regressão.
- Secrets (`GEMINI_API_KEY`, `ADMIN_USER_IDS`, `EXTRA_CORS_ORIGINS`) replicados na function.
- Só então desprovisionar o serviço no Railway.

## Verificação

- **A, por fase**: deploy + chamada direta com JWT real comparando payload/status com a mesma chamada no Railway, antes de avançar pra próxima fase.
- **Embeddings**: após o backfill, rodar uma busca conhecida (`match_chunks`) e conferir que os resultados fazem sentido (não uma mistura de espaços vetoriais).
