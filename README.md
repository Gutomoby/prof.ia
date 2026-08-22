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
├── backend/                     # FastAPI
│   ├── main.py                  # CORS + healthcheck + routers
│   ├── routers/                 # professores · documentos · atividades · score
│   │                            # progresso · calendario · chat (stub)
│   ├── services/                # rag.py · claude.py · pdf.py · scoring.py · progress.py
│   └── models.py                # schemas Pydantic
│
└── supabase/migrations/         # 001 inicial · 002 planos · 003 calendário + progressão
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

### ✅ Já no ar (produção: Vercel + Railway)

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
- **Login social funcionando de ponta a ponta** (Google/Apple) + perfil criado automaticamente no signup (`profiles` + trigger)

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

- [ ] Streak com base em horários
- [ ] Recompensa de meta batida (badges + animações)
- [ ] Notificações push, widget e e-mail

---

## 🎯 Foco — Próximos meses

Ordem de prioridade combinada, do que destrava o próximo até o que só faz sentido no fim:

- [ ] **1. Migrar o backend para Supabase Edge Functions** *(em andamento — status e plano completo em [`docs/migracao-supabase.md`](docs/migracao-supabase.md))* — sai do Railway, roteador preserva os paths do FastAPI para migrar domínio por domínio sem reescrever telas
  - [x] Conta: `/auth/callback` (login social) + `profiles`/trigger de signup
  - [x] Fase 1 — `conquistas` + `progresso`
  - [ ] Fases 2 a 6 — `professores`, `calendario`, `admin`, `score`, `modulos`, `atividades`, `documentos`
- [ ] **2. Atualizar o site** já rodando na arquitetura nova
- [ ] **3. App mobile (Android + iOS)** — construir até **criar conta** funcionar de ponta a ponta primeiro; gestão de usuários fica para depois
- [ ] **4. Gestão de usuários** no app mobile
- [ ] **5. Otimizar custo e IA** (modelo de embeddings, prompt caching, escolha de modelo por tarefa)
- [ ] **6. Publicar nas lojas** — App Store e Google Play

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
