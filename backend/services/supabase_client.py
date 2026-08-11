"""
Cliente Supabase server-side (com service_role).

ATENÇÃO: a service_role key bypassa RLS. Este cliente NUNCA pode ser exposto ao
navegador. Use só no backend.

Um cliente POR THREAD, não um por processo
------------------------------------------
Este módulo mantinha um singleton com `lru_cache(maxsize=1)`. O raciocínio era
economizar a sessão HTTP keep-alive — mas o FastAPI executa endpoints `def`
(síncronos, que é o caso de quase todos os nossos) num pool de threads, e o
cliente do supabase-py carrega um `httpx.Client` síncrono, que NÃO é
thread-safe: várias threads dividiam a mesma conexão HTTP/2.

O resultado em produção era esse, com vários endpoints falhando no mesmo
instante:

    httpcore.ReadError: [Errno 11] Resource temporarily unavailable
      File "postgrest/_sync/request_builder.py", line 58, in execute

Errno 11 é EAGAIN: duas threads lendo o mesmo socket. Aparecia como upload que
"dá erro mas salva" — a inserção do documento passava e a dos chunks caía na
corrida, deixando material sem nenhum pedaço indexado — e como 500 aleatório em
telas que disparam várias chamadas de uma vez.

`threading.local()` dá a cada thread do pool o seu cliente. O pool é pequeno e
reutilizado, então continuam sendo poucas conexões vivas; o keep-alive que o
singleton queria preservar continua valendo dentro de cada thread.
"""

import threading

from supabase import Client, create_client

from services.config import settings

_local = threading.local()


def get_supabase() -> Client:
    """Cliente Supabase da thread atual, criado na primeira chamada dela."""
    cliente = getattr(_local, "cliente", None)
    if cliente is None:
        cliente = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_SERVICE_ROLE_KEY,
        )
        _local.cliente = cliente
    return cliente
