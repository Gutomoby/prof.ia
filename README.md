<div align="center">

# 🎓 ProfessorIA

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

ProfessorIA é um app de estudos *self-hosted* onde cada usuário cria um **"professor virtual"** especializado em uma matéria. O professor:

- 💬 **Conversa** com você sobre o conteúdo (chat com streaming)
- 📝 **Gera atividades** em 4 modos: Quiz, Simulado, Prova, Reforço
- 📊 **Pontua** seus erros por tópico e tipo de questão
- 🧭 **Recomenda** o que estudar a seguir, baseado nos seus pontos fracos

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
professor-ia/
├── frontend/                    # Next.js 14 (App Router)
│   ├── app/
│   │   ├── (auth)/login/        # tela de login
│   │   └── (app)/               # rotas autenticadas
│   │       ├── page.tsx         # home: lista de professores
│   │       └── professor/[id]/  # chat, quiz, simulado, prova, reforço, score
│   ├── components/{ui,chat,atividade,score}/
│   └── lib/{supabase.ts,api.ts,utils.ts}
│
├── backend/                     # FastAPI
│   ├── main.py                  # CORS + healthcheck + routers
│   ├── routers/                 # professores, documentos, chat, atividades, score
│   ├── services/                # rag.py · claude.py · pdf.py
│   └── models.py                # schemas Pydantic
│
└── supabase/migrations/
    └── 001_initial.sql          # 5 tabelas + pgvector + RLS + match_chunks()
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

| Tipo | Questões | Timer | Correção | Modelo |
|---|---|---|---|---|
| **Quiz** | 5–8 múltipla escolha | ❌ | imediata | Haiku 4.5 |
| **Simulado** | 10–15 múltipla escolha | ⏱️ 1 min/questão | só no final | Haiku 4.5 |
| **Prova** | 5–8 + 2 discursivas | ⏱️ | IA (Sonnet) | Sonnet 4 |
| **Reforço** | 3–5 focadas em pontos fracos | ❌ | imediata | Haiku 4.5 |

---

## 🗺️ Roadmap

- [x] **Fase 1** — Estrutura, configs, schema SQL, .env.example
- [x] **Fase 2** — RAG completo (chunking, embeddings, busca vetorial, upload PDF/texto)
- [ ] **Fase 3** — Chat com streaming (SSE)
- [ ] **Fase 4** — Telas: criar professor, configurar material, chat
- [ ] **Fase 5** — Atividades (quiz → simulado → prova → reforço)
- [ ] **Fase 6** — Score + recomendação por IA
- [ ] **Fase 7** — Auth Supabase + middleware
- [ ] **Fase 8** — Deploy Vercel + Railway

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
