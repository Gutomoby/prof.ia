"""
Ponto de entrada do backend FastAPI do Kango (ex-ProfessorIA).

Para rodar localmente:
    uvicorn main:app --reload --port 8000

Os routers ficam em routers/ — cada arquivo agrupa rotas de um domínio
(professores, documentos, chat, atividades, score). Aqui apenas montamos a app
e configuramos CORS para o frontend Next.js.
"""

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from routers import (
    professores,
    documentos,
    chat,
    atividades,
    score,
    progresso,
    calendario,
    modulos,
    conquistas,
    admin,
    financeiro,
)
from services.config import settings

# Instância principal da aplicação. O título aparece no /docs (Swagger UI).
app = FastAPI(
    title="Kango API",
    description="Backend do Kango: RAG, quizzes e progressão baseados no material do usuário.",
    version="0.2.0",
)

# CORS: libera o frontend Next.js (em dev e em produção) a chamar a API.
# O domínio novo do Kango entra via EXTRA_CORS_ORIGINS (env no Railway),
# sem precisar de deploy de código.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://profia-rose.vercel.app",
        "https://www.kangoguru.com",
        *settings.extra_cors_origins(),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Rota de saúde — útil para verificar se a API está no ar (Railway healthcheck).
@app.get("/health")
def health():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# TEMPORÁRIO — remover depois do backfill confirmado (docs/migracao-supabase.md).
#
# A migration de embeddings pra 768 dims (Gemini) foi revertida de volta pra
# 384 (incidente: quebrou quiz/plano/upload em produção — Railway ainda gera
# a busca localmente em 384 dims). O revert zerou embedding de todos os 361
# chunks já existentes; esta rota reprocessa com o MESMO modelo local que já
# rodava antes (embed_texts, sentence-transformers), sem depender de nenhuma
# API externa nem cota. Protegida por token fixo só pra não ficar 100% aberta
# — não é pensada pra virar rota permanente.
# ---------------------------------------------------------------------------
_REEMBED_384_TOKEN = "bC6wkz6oWNQteXjGC792k8QKySC0FXAv1jFSDsOXzpY"


@app.post("/_maint/reembed-384")
def _maint_reembed_384(x_backfill_token: str = Header(default="")):
    if x_backfill_token != _REEMBED_384_TOKEN:
        raise HTTPException(status_code=401, detail="unauthorized")

    from services.rag import embed_texts, _LOTE
    from services.supabase_client import get_supabase

    sb = get_supabase()
    processados = 0
    erros: list[str] = []

    while True:
        res = (
            sb.table("chunks")
            .select("id, content")
            .is_("embedding", "null")
            .limit(_LOTE)
            .execute()
        )
        rows = res.data or []
        if not rows:
            break
        try:
            vetores = embed_texts([r["content"] for r in rows])
        except Exception as exc:
            erros.append(str(exc))
            break
        for row, vetor in zip(rows, vetores):
            sb.table("chunks").update({"embedding": vetor}).eq("id", row["id"]).execute()
        processados += len(rows)

    restantes = (
        sb.table("chunks").select("id").is_("embedding", "null").execute()
    )
    return {"processados": processados, "restantes": len(restantes.data or []), "erros": erros}


# Registro dos routers. Cada um traz seu prefixo definido no próprio arquivo.
app.include_router(professores.router)
app.include_router(documentos.router)
app.include_router(chat.router)
app.include_router(atividades.router)
app.include_router(score.router)
app.include_router(progresso.router)
app.include_router(calendario.router)
app.include_router(modulos.router)
app.include_router(conquistas.router)
app.include_router(admin.router)
app.include_router(financeiro.router)
