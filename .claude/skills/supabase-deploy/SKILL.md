---
name: supabase-deploy
description: Use ao fazer deploy da Edge Function "api" deste projeto (supabase/functions/) via MCP deploy_edge_function ou CLI supabase. Evita o erro "Module not found" e deploys que demoram muito por tentativa-e-erro.
---

# Deploy da Edge Function `api`

## A regra que importa

`mcp__Supabase__deploy_edge_function` **substitui o conjunto inteiro de
arquivos publicados a cada chamada — não é incremental.** Mandar só o
arquivo que mudou apaga (do ponto de vista do bundler) todos os outros.
O erro que aparece quando falta algum é sempre o mesmo formato:

```
Failed to bundle the function (reason: Module not found "file:///.../source/api/routes/X.ts")
```

Isso não significa que `X.ts` está quebrado — significa que ele não foi
incluído na chamada. **Toda chamada de deploy precisa conter os 27
arquivos completos**, mudou um ou mudaram todos.

## Procedimento

1. Confirme a lista canônica de arquivos (ela muda só quando uma rota
   nova é adicionada em `api/index.ts`):

   ```bash
   find supabase/functions/_shared supabase/functions/api -name "*.ts" | sort
   ```

   Hoje são 27: 13 em `_shared/`, `api/index.ts`, e 13 em `api/routes/`.
   `supabase/functions/stripe-webhook/` é uma function **separada** —
   não entra nesse deploy.

2. Leia o conteúdo de TODOS os 27 com a ferramenta Read (nenhum passa de
   500 linhas, cabem na leitura padrão).

3. Monte o array `files` da chamada com uma entrada por arquivo:
   `{"name": "<caminho relativo dentro de supabase/functions/, ex: _shared/db.ts ou api/routes/modulos.ts>", "content": "<conteúdo completo>"}`.
   O `name` precisa bater exatamente com os imports relativos que os
   arquivos usam entre si (`../_shared/router.ts`, `./routes/modulos.ts`
   etc.) — é assim que o bundler do Deno resolve os módulos.

4. Uma única chamada, com os 27 completos:
   - `project_id`: `rwvvfvxyfmhsftctquhd`
   - `name`: `"api"`
   - `entrypoint_path`: `"api/index.ts"`
   - `verify_jwt`: `true`

5. Se o payload ficar grande demais pra montar numa resposta só (isso já
   aconteceu — 27 arquivos passam de 130 mil caracteres), delegue pra um
   subagente com instrução explícita de **ler os 27 do disco e montar a
   chamada única ele mesmo**, em vez de tentar dividir em múltiplas
   chamadas de deploy — múltiplas chamadas parciais é exatamente o que
   causa o erro "Module not found" e o retrabalho.

## Atalho: CLI local

Se estiver rodando numa máquina com Deno + Supabase CLI instalados (ver
seção "Ferramental local" do CLAUDE.md), `supabase functions deploy api`
resolve tudo isso sozinho — lê o diretório inteiro, sem precisar montar
o array de arquivos na mão. Prefira o MCP só quando não há CLI local
disponível (como numa sessão remota sem filesystem persistente/login).
