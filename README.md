<div align="center">

# 🦘 Kango

**O seu companheiro de estudos** *(ex-ProfessorIA)*

**Crie um professor virtual de qualquer matéria — alimentado pelo seu próprio material.**

Gere quizzes e provas, resuma cada capítulo, converse livremente sobre o material e acompanhe sua evolução por tópico.
Tudo com RAG sobre os PDFs e textos que **você** sobe.

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js&logoColor=white)](https://nextjs.org)
[![Deno](https://img.shields.io/badge/Supabase-Edge%20Functions%20(Deno)-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/docs/guides/functions)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20pgvector-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![Claude](https://img.shields.io/badge/Claude-Haiku%204.5-D97757)](https://www.anthropic.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

</div>

---

## ✨ O que é 

Kango é um app de estudos *self-hosted* onde cada usuário cria um **"professor virtual"** especializado em uma matéria. O professor:

- 📝 **Gera quizzes** por capítulo, com correção imediata e revisão questão a questão
- 🎓 **Aplica provas** — a matéria inteira de uma vez, correção só no final, como uma prova de verdade
- 📄 **Resume** cada capítulo da trilha num "timbrado" próprio, gerado a partir do seu material
- 💬 **Conversa** livremente sobre tudo que você já enviou, num chat com histórico
- 📊 **Pontua** seus erros por tópico e mostra a trilha do que você domina
- 🧭 **Recomenda** o que estudar a seguir, baseado nos seus pontos fracos
- 🔥 **Acompanha** XP, nível e sequência diária entre todas as matérias

Tudo apoiado em **RAG**: o professor responde com base nos PDFs e textos que **você** subiu — não em "conhecimento geral" da IA.

---

## 🧱 Stack

| Camada | Tecnologia | Por quê |
|---|---|---|
| Frontend | **Next.js 14** (App Router) + **Tailwind** | DX ótimo, componentes prontos, deploy fácil |
| Backend | **Supabase Edge Functions** (Deno/TypeScript) | Sem servidor pra manter, deploy junto do resto do Supabase |
| Processamento pesado | **Google Cloud Run** (Python/Flask) | Extração de PDF e geração de módulos/trilha (Sonnet) — fora do teto de CPU das Edge Functions |
| DB / Auth / Storage | **Supabase** (Postgres + **pgvector**) | Tudo num só backend, com RLS |
| LLM | **Claude Haiku 4.5** (quiz, prova, resumo, chat) + **Sonnet** (geração de módulos, no Cloud Run) | Haiku cobre praticamente tudo que o aluno usa no dia a dia; Sonnet só onde a qualidade de organizar o material pesa mais |
| Embeddings | **Gemini** (`gemini-embedding-2`, 768 dims) | API — sem manter um serviço de ML à parte |
| Pagamento | **Stripe Checkout** (assinatura com trial de 7 dias) | Nativo, sem lógica própria de trial |
| Deploy | **Vercel** (frontend) + **Supabase** (Edge Functions) + **Cloud Run** (processamento) | Sem servidor dedicado pra manter no ar |

> ✅ **Migração concluída**: o backend rodava em FastAPI/Railway; hoje quem atende produção é Supabase Edge Functions + Cloud Run, com o mesmo contrato de rotas do FastAPI original. O código Python antigo continua em `backend/` só como referência histórica do porte — não é mais deployado. Histórico completo da migração em [`docs/migracao-supabase.md`](docs/migracao-supabase.md).

---

## 💰 Custo estimado (por usuário ativo)

| Item | Custo mensal |
|---|---|
| Supabase Free tier (500 MB DB, 1 GB Storage) | **$0** |
| Vercel Hobby | **$0** |
| Cloud Run (extração de PDF + geração de módulos) | **~$0** (free tier cobre uso pessoal) |
| Embeddings (Gemini, por documento enviado) | **centavos** |
| Claude Haiku — quiz, prova, resumo e chat (uso realista: 1 quiz/dia + 2 resumos/semana + chat leve) | **~$0,90** |
| **Total por usuário** | **~$1-2/mês** |

> Medido em produção via `/admin/financeiro` (custo diferenciado por operação, com drill-down por atividade individual — quanto custou UM quiz, UMA prova, UM resumo ou UMA sessão de chat). Cada operação loga seu custo real em `token_logs`; nada aqui é estimativa de tabela de preço sem dado por trás.

---

## 🗂️ Estrutura

```
kango/  (repo: prof.ia)
├── frontend/                    # Next.js 14 (App Router)
│   ├── app/
│   │   ├── (auth)/login/        # tela de login
│   │   ├── (licao)/             # modo foco: lição e prova, sem sidebar/abas
│   │   │   ├── licao/[id]/      # quiz — corrige questão por questão
│   │   │   └── prova/[id]/      # prova — matéria inteira, correção só no final
│   │   └── (app)/               # rotas autenticadas (sidebar + abas)
│   │       ├── dashboard/       # home: trilha, ferramentas do Kango, revisão, material
│   │       ├── calendario/      # calendário cross-matéria
│   │       ├── biblioteca/      # acervo global de materiais
│   │       ├── assinatura/      # planos + checkout Stripe (trial de 7 dias)
│   │       ├── admin/           # painel admin: usuários, financeiro (custo por atividade)
│   │       └── professor/[id]/  # visão geral, progresso, quiz, chat, resumo, material, ajustes
│   ├── components/{ui,layout,quiz,professor,score,calendario,progress}/
│   └── lib/                     # api.ts · supabase.ts · next-step.ts · professor-color.ts
│
├── backend/                     # FastAPI — código legado do porte inicial, NÃO deployado
│   │                            # (referência histórica; produção roda em supabase/functions)
│   ├── routers/ · services/ · models.py
│
├── gcp/pdf-processor/           # Cloud Run (Python/Flask) — o que as Edge Functions não
│                                 # conseguem fazer no teto de CPU: extração de PDF grande
│                                 # e geração de módulos/trilha (Claude Sonnet)
│
├── supabase/
│   ├── functions/               # Backend em produção (Deno)
│   │   ├── _shared/             # auth, db, claude (quiz/prova/resumo/chat), embeddings,
│   │   │                        # notacao, scoring, progresso, planos...
│   │   ├── api/routes/          # um arquivo por domínio: atividades (quiz/prova), resumos,
│   │   │                        # chat, score, modulos, financeiro, assinaturas...
│   │   └── stripe-webhook/      # function separada (verify_jwt: false — Stripe não manda JWT)
│   └── migrations/              # schema do Postgres
│
├── mobile/                      # Capacitor — casca nativa apontando pro site em produção
│
└── docs/migracao-supabase.md    # histórico da migração FastAPI/Railway → Supabase
```

---

## 🔄 Como o RAG funciona

```
PDF/texto subido
   ↓
Cloud Run: extrai texto (PDF grande estoura o teto de CPU da Edge Function)
   ↓
chunkText  →  ~500 tokens com 50 de overlap (tiktoken)
   ↓
Gemini embeddings  →  vetor de 768 dims
   ↓
INSERT em chunks (pgvector)


Quiz / Prova / Resumo / Chat
   ↓
searchChunks(query, professor_id, top_k)      # prova busca por capítulo e junta (dedup),
   ↓                                          # pra não perder cobertura de nenhum um deles
Top-k trechos + system prompt do professor
   ↓
Claude Haiku
   │
   ├─ Quiz/Prova/Resumo: tool-forced → JSON estruturado direto
   └─ Chat: texto livre, sem tool-forcing (histórico da sessão inteiro entra no prompt)
   ↓
Resposta na UI + custo logado em token_logs (por operação e por atividade)
```

---

## 🚀 Como rodar localmente

> **Pré-requisitos**: Node.js 18+, conta Supabase, chave Anthropic. Deno e a Supabase CLI só entram se você for mexer nas Edge Functions localmente (ver nota abaixo) — não vêm com o Windows nem sincronizam via OneDrive, precisam ser instalados por máquina.

O backend real (Edge Functions) roda no Supabase — não há um servidor local pra subir equivalente ao antigo `uvicorn`. Pra desenvolver o **frontend** contra o backend de produção:

> Criando um projeto Supabase do zero: aplique as ~15 migrations de `supabase/migrations/` **em ordem** via `supabase db push` (Supabase CLI) — não é mais um `001_initial.sql` único colado no SQL Editor, o schema cresceu incrementalmente desde então.

### 1️⃣ Configurar variáveis

```bash
cp .env.example frontend/.env.local
# Preencha NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e
# NEXT_PUBLIC_API_URL (a URL da Edge Function `api`, formato
# https://<project-ref>.supabase.co/functions/v1/api)
```

### 2️⃣ Frontend

```bash
cd frontend
npm install
npm run dev
```

🌐 Abrir: http://localhost:3000

### Mexendo nas Edge Functions (opcional)

Com a [Supabase CLI](https://github.com/supabase/cli/releases/latest) instalada: `deno check`/`deno lint` em `supabase/functions/` antes de cada deploy, e `supabase functions deploy api` (ou a tool `deploy_edge_function` do MCP, que não exige login local) — sempre mandando o bundle **inteiro** da function, não só o arquivo alterado. Detalhes de convenção em [`CLAUDE.md`](CLAUDE.md).

`backend/` (FastAPI) continua no repo como referência do porte original, mas não é mais deployado — não precisa de `.venv` pra rodar o produto.

---

## 🎯 Tipos de atividade

| Tipo | Escopo | Questões | Correção | Modelo | Status |
|---|---|---|---|---|---|
| **Quiz** | um capítulo (ou tópico livre) | 5–10 múltipla escolha | imediata, questão a questão | Haiku 4.5 | ✅ no ar |
| **Prova** | a matéria inteira | 12–15 múltipla escolha | só no final, como uma prova de verdade | Haiku 4.5 | ✅ no ar |
| **Resumo** | um capítulo | — (não é quiz) | — | Haiku 4.5 | ✅ no ar |
| **Chat** | todo o material enviado | — (conversa livre) | — | Haiku 4.5 (sem tool-forcing) | ✅ no ar |
| **Simulado** | ainda não desenhado | — | — | — | não iniciado |
| **Reforço** | ainda não desenhado | — | — | — | não iniciado |

> Prova ficou mais simples do que a visão original (que previa discursivas corrigidas por Sonnet): múltipla escolha, mesmo modelo do quiz — a diferença real é o escopo (a trilha inteira, não um capítulo) e o momento da correção (só no final).

---

## 🗺️ Andamento e Roadmap

### ✅ Já no ar (produção: Vercel + Supabase Edge Functions + Google Cloud Run)

- **RAG completo** — upload de PDF/texto (extração no Cloud Run), chunking, embeddings Gemini, busca vetorial
- **Professores por matéria** — criar, editar e apagar (tela Ajustes)
- **Quiz por IA** — correção imediata, revisão questão a questão, histórico
- **Prova** — a matéria inteira de uma vez, navegação livre entre questões, tela de revisão antes de enviar, correção só no final
- **Resumo por capítulo** — "timbrado" próprio (paleta azul cobalto), gerado por RAG só do material daquele capítulo
- **Chat livre** — RAG sobre todo o material do professor, uma sessão contínua por matéria, renderiza negrito/lista/fórmula na resposta
- **Score por tópico** + plano de estudos gerado por IA
- **Tela de revisão** (resultado de quiz/prova) com destaque de nota, tópicos que acabaram de ser dominados e agrupamento por tópico das questões erradas
- **Home "o que fazer hoje"** — próximo passo global consolidando todas as matérias, com atalho direto pra Chat/Resumo/Prova da matéria em foco
- **Trilha serpenteante** de tópicos por professor
- **Assinatura** — tela de planos + Checkout do Stripe com trial de 7 dias nativo (`subscription_data.trial_period_days`); ainda **sem gate de acesso** por decisão deliberada — todo mundo usa livre até o produto estar pronto
- **Painel financeiro admin** — custo real de IA diferenciado por operação (quiz/prova/resumo/chat) e por modelo, com drill-down por atividade individual (quanto custou UM quiz, UMA prova, UM resumo, UMA sessão de chat)
- **Calendário cross-matéria** — dias estudados + provas e eventos próprios
- **Biblioteca global** de materiais
- **Progressão** — XP, níveis e sequência diária (contada no fuso do usuário)
- **Auth Supabase**, navegação mobile, temas claro/escuro (WCAG AA), deploy contínuo
- **Cadastro por e-mail/senha** + perfil criado automaticamente no signup (`profiles` + trigger) — login social (Google/Apple) ainda **não está ativo** em produção (retorna `Unsupported provider`; falta configurar os providers no Supabase + credenciais OAuth no Google Cloud Console)
- **Recuperação de senha funcionando de ponta a ponta** (o link de e-mail voltou a autenticar de verdade)

### 🚨 Urgente — Rebranding Kango (Fase A)

- [x] Nome novo no app, na API e no repositório
- [x] Identidade visual: azul cobalto (foco) + âmbar (gamificação), temas claro/escuro
- [x] CORS preparado para o domínio novo via env `EXTRA_CORS_ORIGINS` (entra sem deploy)
- [ ] Logo oficial — wordmark provisório centralizado em `components/layout/Brand.tsx`
- [ ] Assets do mascote Kango na UI
- [ ] Migração do domínio

### 🔜 Fase B — Experiência e UI

- [ ] Integração maior Material → Trilha → Quizzes (fluxo unificado)
- [ ] Melhorar pós-processamento do material (resultado visual)
- [ ] Visualização de módulos: tela dedicada por professor
- [ ] Tutorial embarcado na tela de configurar o professor
- [ ] Seletor de dificuldade/complexidade visível nas telas
- [ ] Segregar visualmente configuração × ambiente de estudo
- [ ] Carregamento inicial: de ~4s para quase instantâneo

### 🔜 Fase C — Arquitetura core

- [ ] Três modos de quiz: **Aprender** · **Exercitar** · **Desafiar** *(educacional)*
- [x] Login fácil — social login *(magic link ainda não)*
- [ ] Novos quizzes gerados todo dia + trilha reprocessada automaticamente *(oxigenação)*
- [ ] Várias opções de IA por tipo de task *(eficiência)*
- [ ] Modo Kids e modo normal *(aderência)*
- [ ] Modo Sala de Aula — PDF com todo o material *(armazenamento)*
- [x] Chat com o professor — RAG livre sobre todo o material, uma sessão por matéria
- [x] Prova — a matéria inteira de uma vez, correção só no final (a versão que shippou é mais simples que o "Modo Apostila via Sonnet" cogitado antes: múltipla escolha, Haiku, igual ao quiz — o que muda é escopo e o momento da correção)
- [x] Resumo por capítulo — não estava no roadmap original, entrou junto do Chat/Prova por pedido direto do usuário

### 🔜 Fase D — Engajamento e retenção

Referência declarada pelo usuário (2026-09-07): a "vibe Duolingo" — não é
imitar a tela, é a mesma lógica de trazer o aluno de volta todo dia.

- [ ] Streak com base em horários
- [ ] Recompensa de meta batida (badges + animações)
- [ ] Notificações push lembrando de fazer a lição (base técnica local já existe:
      `@capacitor/local-notifications` em `CapacitorNative.tsx`, hoje só lembrete
      diário fixo — falta o gatilho "ainda não estudou hoje")
- [ ] Sons de interação: apertar botão, acertar, errar
- [ ] Widgets de tela inicial com o streak *(depende de código nativo por
      fora do WebView do Capacitor — WidgetKit no iOS, App Widgets no
      Android; não é algo que o wrapper atual cobre sozinho)*
- [ ] Social (fica pra depois de tudo acima): ver progresso de amigos,
      compartilhar progresso, ligas/rankings

---

## 🎯 Foco — Próximos meses

Decidido em 2026-09-07. Backend já migrado (Edge Functions + Cloud Run, Railway fora do caminho) — o roadmap agora é sobre produto, não mais sobre arquitetura. Detalhe granular de cada item vive nas Fases A–D acima; esta lista é a ordem de prioridade combinada.

- [ ] **1. Deixar o app 100% funcionando e com as artes em dia**
  - [x] PDF, geração de trilha e quiz rodando via Edge Functions + Cloud Run, sem o teto de 2s CPU do Railway
  - [x] Cadastro por e-mail/senha de ponta a ponta
  - [ ] Testar caminho feliz de cada rota com usuário real logado em produção
  - [ ] Identidade visual final (logo, mascote) e ícone/splash do app mobile (hoje é placeholder do favicon em `mobile/resources/`)
- [ ] **2. Experiência do usuário e criação de contas**
  - [ ] Ativar login social (Google/Apple) — hoje retorna `Unsupported provider`, falta configurar os providers no Supabase + credenciais OAuth
  - [ ] Revisar o fluxo de criação de conta ponta a ponta (o que acontece na primeira sessão de um usuário novo)
- [ ] **3. Custos e assinaturas**
  - [x] Custo real de IA chegando certo no `/admin/financeiro`, diferenciado por operação (quiz/prova/resumo/chat, cada um logava certo exceto prova — corrigido) e por atividade individual (drill-down: quanto custou UM quiz, UMA prova, UMA sessão de chat)
  - [x] Tela de assinatura com 3 planos + Checkout do Stripe (trial de 7 dias nativo, `subscription_data.trial_period_days`) — webhook próprio confirma pagamento/cancelamento
  - [ ] Gate de acesso por plano (Chat/Resumo/Prova hoje são livres pra todo mundo) — decisão explícita: só depois que o produto estiver pronto, pra não ter retrabalho
  - [ ] Loja de energia/moedas para destravar chat além do limite do plano — pago com dinheiro real (aceita repassar % pra Apple/Stripe); web/Android via Pix/Stripe direto, iOS depende de IAP (ver item 5)
- [x] **4. Chat, Resumo e Prova** *(não existiam no backend antes de 2026-09-08 — construídos e no ar)*
  - [x] Chat livre com o professor, RAG sobre todo o material enviado
  - [x] Resumo por capítulo da trilha, com design "timbrado" próprio
  - [x] Prova — a matéria inteira de uma vez, correção só no final
- [ ] **5. Lançamento do app nas lojas** — App Store e Google Play
  - [x] Base técnica do app nativo (Capacitor em `mobile/`, ver Fase B/C acima)
  - [ ] Gerar os projetos nativos e testar no Mac (`npx cap add ios/android` + `npx cap sync`)
  - [ ] Conta Apple Developer, política de privacidade, ficha da loja — decisão de IAP já tomada (aceita o corte da Apple), falta formalizar a conta e a integração StoreKit
  - **Tablets não são um 6º front separado** — mesmo app/site, só depende do layout responsivo aguentar telas maiores (verificar num tablet real quando o app nativo estiver rodando)

---

## ☁️ Deploy no Vercel (frontend)

O frontend já está pronto pra subir. Em ~3 minutos:

1. **Importe o repo**: vá em https://vercel.com/new → conecte sua conta GitHub → selecione `Gutomoby/prof.ia`.
2. **Configure o Root Directory**: clique em "Edit" e troque para `frontend` (sem isso o Vercel não acha o `package.json`).
3. **Adicione as Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL` = sua URL do Supabase
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = sua anon key
   - `NEXT_PUBLIC_API_URL` = a URL da Edge Function `api` já deployada (`https://<project-ref>.supabase.co/functions/v1/api`) — o backend não precisa de deploy à parte, já está no Supabase
4. Clique em **Deploy**. Em ~1 minuto o site está no ar com URL `*.vercel.app`.

> Cada `git push origin main` redeploya automaticamente.

## 🤝 Contribuição

Este é um projeto pessoal em estágio inicial. Issues e PRs são bem-vindos para discutir arquitetura ou reportar bugs.

## 📄 Licença

[MIT](LICENSE) — use, modifique, distribua. Atribuição é apreciada mas não obrigatória.

---

<div align="center">

Feito com ❤️ para estudar de verdade.

</div>
