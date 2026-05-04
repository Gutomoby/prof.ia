"""
Settings centralizados — leem variáveis do `.env` (em dev) e do ambiente
(em produção). Use `from services.config import settings` em qualquer lugar.

Por que pydantic-settings: dá tipagem, validação e mensagem de erro clara
quando uma variável obrigatória está faltando, em vez de explodir lá na frente.
"""

from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Caminho absoluto até backend/.env. Resolvido a partir deste próprio arquivo,
# para funcionar independente do diretório de onde o uvicorn é invocado.
# (config.py vive em backend/services/, então .parent.parent volta até backend/.)
_ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    # Lê do backend/.env e ignora variáveis extras (NEXT_PUBLIC_* etc.).
    model_config = SettingsConfigDict(
        env_file=_ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- Supabase ---
    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str = Field(
        ...,
        description="Service role key — bypassa RLS. Backend-only, nunca expor.",
    )

    # --- Anthropic (Claude) ---
    ANTHROPIC_API_KEY: str

    # --- Embeddings (modelo local) ---
    EMBEDDING_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"

    # --- RAG: parâmetros de chunking ---
    # Centralizados aqui pra não ficarem espalhados em vários arquivos.
    CHUNK_SIZE_TOKENS: int = 500
    CHUNK_OVERLAP_TOKENS: int = 50
    RAG_TOP_K: int = 5

    # --- Storage ---
    STORAGE_BUCKET: str = "materiais"


# Instância única importada pelos outros módulos.
# O parsing acontece aqui, então erros de config aparecem no startup.
settings = Settings()  # type: ignore[call-arg]
