"""
Cliente Supabase server-side (com service_role).

Usa lru_cache para garantir UMA instância no processo — o cliente Supabase
mantém uma sessão HTTP keep-alive, então recriar em toda chamada é desperdício.

ATENÇÃO: a service_role key bypassa RLS. Este cliente NUNCA pode ser
exposto ao navegador. Use só no backend.
"""

from functools import lru_cache

from supabase import Client, create_client

from services.config import settings


@lru_cache(maxsize=1)
def get_supabase() -> Client:
    """Retorna o cliente Supabase compartilhado (singleton dentro do processo)."""
    return create_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_SERVICE_ROLE_KEY,
    )
