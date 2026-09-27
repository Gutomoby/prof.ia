---
name: supabase-deploy
description: Use ao publicar Edge Functions deste projeto (supabase/functions/) via MCP deploy_edge_function ou CLI supabase. Explica a divisão em funções por domínio e como publicar sem estourar o limite de tamanho.
---

# Deploy das Edge Functions

## Como o backend está dividido

| Função | Entrypoint | Rotas |
|---|---|---|
| `atividades` | `atividades/index.ts` | `/atividades/*` (quiz, prova, correção) |
| `ia` | `ia/index.ts` | `/professores/:id/modulos*`, `/professores/:id/chat` (trilha, resumo, chat) |
| `admin` | `admin/index.ts` | `/admin/*`, `/assinatura/*` |
| `api` | `api/index.ts` | todo o resto (e cópias antigas das rotas acima — não são mais chamadas) |

O frontend decide a função em `frontend/lib/api.ts` (`FUNCAO_POR_ROTA`).
Rota nova de um desses domínios: registrar no `index.ts` da função certa E
conferir que o padrão em `FUNCAO_POR_ROTA` cobre o caminho.

A divisão existe porque a `api` inteira (~170 KB de fonte) passou do tamanho
que dá pra mandar numa chamada `deploy_edge_function`: o conteúdo de todos os
arquivos vai inline na chamada, e a resposta do modelo tem teto de saída.

## Regras do deploy via MCP

1. `deploy_edge_function` **substitui o conjunto inteiro de arquivos** a cada
   chamada — não é incremental. Faltou um import → `Module not found`.
2. Não mande os fontes soltos: empacote a função num arquivo só com esbuild e
   publique esse arquivo (`entrypoint_path: "index.js"`):

   ```bash
   cd supabase/functions
   npx deno check <funcao>/index.ts && npx deno lint api/ _shared/ <funcao>/
   npx esbuild@0.25 <funcao>/index.ts --bundle --format=esm --platform=neutral \
     --target=es2022 --external:'npm:*' --external:'jsr:*' \
     --minify-identifiers --minify-syntax --charset=utf8 --legal-comments=none \
     --outfile=<scratchpad>/<funcao>/index.js
   ```

   NÃO use `--minify-whitespace`/`--line-limit`: quebra strings com `\` no fim
   de linha, e transcrever isso sem erro é quase impossível.
3. Teste local antes (sobe e responde 401 sem token = roteamento ok):
   `SUPABASE_URL=http://127.0.0.1:1 SUPABASE_ANON_KEY=x SUPABASE_SERVICE_ROLE_KEY=x npx deno run -A index.js`
   e `curl http://127.0.0.1:8000/functions/v1/<funcao>/<rota>`.
4. Cada função empacotada fica em ~25 KB — cabe numa chamada. Se uma passar
   de ~40 KB, divida de novo em vez de tentar forçar.
5. `verify_jwt: true` em todas (todas as rotas exigem login).

## Ambiente

- `npx deno` e `npx supabase` funcionam no container remoto; `deno`/`supabase`
  soltos não estão instalados.
- A rede do container **bloqueia** `*.supabase.co` — não dá pra testar a
  função publicada com curl daqui. Confira pelos logs
  (`mcp__Supabase__query_logs`, source `function_edge_logs`).
- Com um Supabase Personal Access Token (`SUPABASE_ACCESS_TOKEN`), o CLI
  (`npx supabase functions deploy <funcao> --project-ref rwvvfvxyfmhsftctquhd`)
  publica direto do disco, sem nada disso — é o caminho preferível se o token
  estiver disponível.
