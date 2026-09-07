<div align="center">

# 🦘 Kango

**O seu companheiro de estudos** *(ex-ProfessorIA)*

**Crie um professor virtual de qualquer matéria — alimentado pelo seu próprio material.**

Tire dúvidas, gere quizzes, simulados e provas, e acompanhe sua evolução por tópico.
Tudo com RAG sobre os PDFs e textos que **você** sobe.

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js&logoColor=white)](https://nextjs.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20pgvector-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![Claude](https://img.shields.io/badge/Claude-Sonnet%204%20%2B%20Haiku%204.5-D97757)](https://www.anthropic.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

</div>

---

## ✨ O que é 

Kango é um app de estudos *self-hosted* onde cada usuário cria um **"professor virtual"** especializado em uma matéria. O professor:

- 📝 **Gera quizzes** com correção imediata e revisão questão a questão
- 📊 **Pontua** seus erros por tópico e mostra a trilha do que você domina
- 🧭 **Recomenda** o que estudar a seguir, baseado nos seus pontos fracos
- 🔥 **Acompanha** XP, nível e sequência diária entre todas as matérias
- 💬 **Conversa** com você sobre o conteúdo *(chat em construção)*

Tudo apoiado em **RAG**: o professor responde com base nos PDFs e textos que **você** subiu — não em "conhecimento geral" da IA.

---

## 🧱 Stack

| Camada | Tecnologia | Por quê |
|---|---|---|
| Frontend | **Next.js 14** (App Router) + **Tailwind** + **shadcn/ui** | DX ótimo, componentes prontos, deploy fácil |
| Backend | **FastAPI** (Python 3.11+) | Tipagem nativa, async, ótimo p/ streaming |
| DB / Auth / Storage | **Supabase** (Postgres + **pgvector**) | Tudo num só backend, com RLS |
| LLM | **Claude** — Sonnet 4 (chat/prova) + Haiku 4.5 (quiz/simulado/análise) | Qualidade alta + bolso protegido |
| Embeddings | **sentence-transformers** (local, CPU) | **Zero custo recorrente** |
| Deploy | **Vercel** (front) + **Railway** (API) | Free tiers cobrem o uso pessoal |

> 🚧 **Migração em andamento**: o backend está sendo portado de FastAPI/Railway para **Supabase Edge Functions** (Deno), rota por rota, sem trocar o contrato com o frontend. As 6 fases já estão com código deployado; o Railway continua sendo quem atende produção até o corte final. Embeddings passam de sentence-transformers local para a API do Gemini nessa troca. Status e plano completo em [`docs/migracao-supabase.md`](docs/migracao-supabase.md).

---

## 💰 Custo estimado (uso pessoal)

| Item | Custo mensal |
|---|---|
| Supabase Free tier (500 MB DB, 1 GB Storage) | **$0** |
| Vercel Hobby | **$0** |
| Railway Hobby ($5 crédito) | **$0** (cobre o backend) |
| Embeddings (sentence-transformers local) | **$0** |
| Claude API — uso típico (~50 chats + 10 atividades/dia) | **~$3-7** |
| **Total** | **~$3-7/mês** |

> O único gasto recorrente é a Claude API. Para reduzir ainda mais: ative *prompt caching* nas chamadas de chat (repete-se o system prompt + chunks RAG) — economia de até 90% nas chamadas em sequência.

---

## 🗂️ Estrutura

```
kango/  (repo: prof.ia)
├── frontend/                    # Next.js 14 (App Router)
│   ├── app/
│   │   ├── (auth)/login/        # tela de login
│   │   └── (app)/               # rotas autenticadas
│   │       ├── dashboard/       # home: "o que fazer hoje" + matérias
│   │       ├── calendario/      # calendário cross-matéria
│   │       ├── biblioteca/      # acervo global de materiais
│   │       └── professor/[id]/  # visão geral, progresso, quiz, material, ajustes
│   ├── components/{ui,layout,professor,atividade,score,calendario,progress}/
│   └── lib/                     # api.ts · supabase.ts · next-step.ts · professor-color.ts
│
├── backend/                     # FastAPI (Railway — ainda em produção, ver nota da migração acima)
│   ├── main.py                  # CORS + healthcheck + routers
│   ├── routers/                 # professores · documentos · atividades · score
│   │                            # progresso · calendario · chat (stub)
│   ├── services/                # rag.py · claude.py · pdf.py · scoring.py · progress.py
│   └── models.py                # schemas Pydantic
│
├── supabase/
│   ├── functions/               # Edge Functions (Deno) — destino da migração
│   │   ├── _shared/             # porta 1:1 dos services Python (auth, db, claude,
│   │   │                        # embeddings, notacao, pdf, scoring, progresso...)
│   │   └── api/routes/          # um arquivo por domínio, mesmos paths do FastAPI
│   └── migrations/              # schema do Postgres (initial, planos, calendário,
│                                 # progressão, profiles + trigger de signup...)
│
└── docs/migracao-supabase.md    # status e plano da migração pro Supabase
```

---

## 🔄 Como o RAG funciona

```
PDF/texto subido
   ↓
PyMuPDF (extrai texto)
   ↓
chunk_text  →  ~500 tokens com 50 de overlap
   ↓
sentence-transformers  →  vetor de 384 dims (LOCAL)
   ↓
INSERT em chunks (pgvector)


Pergunta do usuário
   ↓
embed_texts(pergunta)
   ↓
SQL: match_chunks(embedding, professor_id, top_k=5)
   ↓
Top-5 trechos + system prompt + histórico
   ↓
Claude (Sonnet) com streaming
   ↓
Resposta token-a-token na UI
```

---

## 🚀 Como rodar localmente

> **Pré-requisitos**: Node.js 18+, Python 3.11+, conta Supabase, chave Anthropic.

### 1️⃣ Configurar variáveis

```bash
# Copie o template
cp .env.example backend/.env
cp .env.example frontend/.env.local

# Preencha as chaves seguindo as instruções dentro do arquivo
```

### 2️⃣ Aplicar o schema no Supabase

No painel do Supabase: **SQL Editor → New query → cole `supabase/migrations/001_initial.sql` → Run**.

### 3️⃣ Backend

```bash
cd backend
python -m venv .venv

# Windows (PowerShell)
.venv\Scripts\Activate.ps1
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

✅ Health: http://localhost:8000/health · 📚 Docs: http://localhost:8000/docs

### 4️⃣ Frontend

```bash
cd frontend
npm install
npm run dev
```

🌐 Abrir: http://localhost:3000

---

## 🎯 Tipos de atividade

> **Hoje só o Quiz está no ar.** Os demais modos evoluem para `Aprender` / `Exercitar` / `Desafiar` + "Prova Final" na Fase C do roadmap Kango (abaixo).

| Tipo | Questões | Timer | Correção | Modelo | Status |
|---|---|---|---|---|---|
| **Quiz** | 5–8 múltipla escolha | ❌ | imediata | Haiku 4.5 | ✅ no ar |
| **Simulado** | 10–15 múltipla escolha | ⏱️ 1 min/questão | só no final | Haiku 4.5 | Fase C |
| **Prova** | 5–8 + 2 discursivas | ⏱️ | IA (Sonnet) | Sonnet 4 | Fase C |
| **Reforço** | 3–5 focadas em pontos fracos | ❌ | imediata | Haiku 4.5 | Fase C |

---

## 🗺️ Andamento e Roadmap

### ✅ Já no ar (produção: Vercel + Supabase Edge Functions + Google Cloud Run)

- **RAG completo** — upload de PDF/texto, chunking, embeddings locais (zero custo), busca vetorial
- **Professores por matéria** — criar, editar e apagar (tela Ajustes)
- **Quiz por IA** — correção imediata, revisão questão a questão, histórico
- **Score por tópico** + plano de estudos gerado por IA
- **Home "o que fazer hoje"** — próximo passo global consolidando todas as matérias
- **Trilha serpenteante** de tópicos por professor
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
- [ ] Questões mais difíceis do módulo viram **Prova Final**
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
- [ ] Modo Apostila — trilha inteira, via Sonnet
- [ ] Chat com o professor (hoje o backend é só um stub)

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
  - [x] Custo real de IA (Haiku/Sonnet) chegando certo no `/admin/financeiro` — corrigido fallback silencioso pro Gemini (modelo antigo desativado pelo Google) e a geração de trilha (Sonnet) que não era logada
  - [ ] Loja de energia/moedas para destravar chat além do limite do plano — pago com dinheiro real (aceita repassar % pra Apple/Stripe); web/Android via Pix/Stripe direto, iOS depende de IAP (ver item 5)
- [ ] **4. Chat e Resumo** *(features novas, hoje não existem no backend)*
  - [ ] Chat com o professor (tier mais caro do plano)
  - [ ] Resumo/plano de estudos como upgrade intermediário (já existe uma versão simples em `score.ts::POST /score/:id/plano` — avaliar se vira essa feature ou se é distinta)
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
   - `NEXT_PUBLIC_API_URL` = pode deixar `http://localhost:8000` por enquanto (o backend ainda não está deployado)
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
