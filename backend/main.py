"""
Ponto de entrada do backend FastAPI do ProfessorIA.

Para rodar localmente:
    uvicorn main:app --reload --port 8000

Os routers ficam em routers/ — cada arquivo agrupa rotas de um domínio
(professores, documentos, chat, atividades, score). Aqui apenas montamos a app
e configuramos CORS para o frontend Next.js.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import professores, documentos, chat, atividades, score

# Instância principal da aplicação. O título aparece no /docs (Swagger UI).
app = FastAPI(
    title="ProfessorIA API",
    description="Backend do ProfessorIA: RAG, chat e atividades baseadas em material do usuário.",
    version="0.1.0",
)

# CORS: libera o frontend Next.js (em dev e em produção) a chamar a API.
# Em produção, troque "*" pelo domínio real do Vercel.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
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
