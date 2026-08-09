"""
Ponto de entrada do backend FastAPI do Kango (ex-ProfessorIA).

Para rodar localmente:
    uvicorn main:app --reload --port 8000

Os routers ficam em routers/ — cada arquivo agrupa rotas de um domínio
(professores, documentos, chat, atividades, score). Aqui apenas montamos a app
e configuramos CORS para o frontend Next.js.
"""

from fastapi import FastAPI
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
