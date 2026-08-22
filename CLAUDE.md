# CLAUDE.md

Notas práticas para trabalhar neste repo — não duplica o que já está no README (stack, estrutura, como rodar). Isso aqui é sobre *como* trabalhar, não *o que é* o projeto.

## Migração em andamento: Railway (FastAPI) → Supabase Edge Functions

O backend está sendo migrado de Python/FastAPI (Railway) para Deno/Edge Functions (Supabase), rota por rota, com o Railway no ar até o fim. Plano detalhado (fases, decisões de arquitetura, critério de "pronto pra desligar o Railway") em [`docs/migracao-supabase.md`](docs/migracao-supabase.md) — commitado no repo de propósito, porque o trabalho atravessa mais de uma máquina (notebook + desktop via OneDrive).

Convenções da migração:
- **Padrão de porte**: cada `services/*.py` vira um `supabase/functions/_shared/*.ts` 1:1 (mesma lógica, mesmos nomes de conceito), e cada `routers/*.py` vira um `supabase/functions/api/routes/*.ts` fino que só faz a ponte HTTP. Nomes de função/variável em português, camelCase (`professoresDoUsuario`, não `professores_do_usuario`) — espelha o Python em conteúdo, não em convenção de case.
- `supabase/functions/_shared/router.ts` preserva os mesmos paths que o FastAPI já servia — é assim que dá pra migrar incrementalmente sem reescrever telas do frontend (só troca `NEXT_PUBLIC_API_URL` no final).
- Contrato de erro do FastAPI preservado: toda resposta de erro é `{"detail": "..."}"` (ver `_shared/http.ts`) — o frontend depende disso.
- Cada domínio migrado: escreve o `.ts`, roda `deno check` + `deno lint` localmente, faz deploy (CLI local `supabase functions deploy` OU MCP `deploy_edge_function` — os dois funcionam; MCP não precisa de login local), testa antes de tocar em `NEXT_PUBLIC_API_URL`.

## Testando Edge Functions sem sessão de usuário real

Não existe um jeito fácil de conseguir um JWT de teste:
- **Não tente ler `backend/.env`** — o Read bloqueia arquivos `.env` de propósito (proteção do próprio Claude Code). Não contornar via `cat`/`Get-Content` no shell.
- **Self-serve signup com domínio de teste (`example.com` etc.) é rejeitado pelo Supabase** (`email_address_invalid`) — proteção deles contra exatamente esse uso.
- **Truque que funciona para testar roteamento/auth sem usuário real**: a *anon key* do projeto é, ela mesma, um JWT validamente assinado (só que sem sessão de usuário associada). Mandar `Authorization: Bearer <anon-key>` passa pelo gateway do Supabase (`verify_jwt`) e chega até o código da function — que aí rejeita com o 401 *da nossa própria lógica* (`currentUserId` → `getUser()` falha por não haver sessão). Serve para confirmar roteamento, CORS, contrato de erro e a cadeia de auth, mas **não** substitui testar o caminho feliz com dado real.
- Teste de caminho feliz (dados reais) fica pendente até existir uma forma limpa de gerar sessão de teste, ou até o usuário validar manualmente antes do flip final de `NEXT_PUBLIC_API_URL`.

## Ferramental local (instalado em 2026-08-22, pode não estar presente em outra máquina)

Node.js, Deno e Supabase CLI não vêm com o Windows nem são sincronizados pelo OneDrive (só o código é). Se `node`/`deno`/`supabase` não forem reconhecidos no PATH, é isso — reinstalar, não presumir que algo quebrou:
- Node.js LTS via `winget install OpenJS.NodeJS.LTS`
- Deno via `winget install DenoLand.Deno`
- Supabase CLI **não está no winget** — baixar o zip de `https://github.com/supabase/cli/releases/latest` (asset `*_windows_amd64.zip`), extrair, adicionar ao PATH do usuário
- `backend/venv` (Python) também não é portável entre máquinas — se o `python.exe` do venv apontar para um usuário/caminho que não existe, é sinal de que veio de outra máquina via OneDrive; recriar com `python -m venv venv`, nunca tentar consertar o caminho antigo

## Convenção de commit

`tipo: descrição curta em português`, minúsculo, sem ponto final — ex. `fix: login social sem sessao e conta nova sem perfil`, `feat: infraestrutura compartilhada das Edge Functions`. Corpo do commit (quando usado) explica o *porquê*, não o *o quê*.
