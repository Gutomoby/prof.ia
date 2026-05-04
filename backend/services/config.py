"""
Settings centralizados — leem variáveis do `.env` (em dev) e do ambiente
(em produção). Use `from services.config import settings` em qualquer lugar.

Por que pydantic-settings: dá tipagem, validação e mensagem de erro clara
quando uma variável obrigatória está faltando, em vez de explodir lá na frente.
"""

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Diz ao pydantic para ler do .env e ignorar variáveis extras
    # (assim podemos manter NEXT_PUBLIC_* no mesmo arquivo sem reclamar).
    model_config = SettingsConfigDict(
        env_file=".env",
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
