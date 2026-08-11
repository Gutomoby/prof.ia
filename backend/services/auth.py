"""
Autenticação — descobre QUEM está chamando a API.

Até agosto/26 o backend inteiro respondia como um único usuário fixo
(`settings.MVP_USER_ID`). O frontend já tinha login Supabase de verdade
(middleware, cookie de sessão, /login e /criar-conta), mas nunca mandava o
token e o backend nunca perguntava. Na prática, a segunda pessoa a criar conta
entraria e veria as matérias, os PDFs e o progresso da primeira.

As policies de RLS existem e estão corretas nas migrations, mas não protegem
nada aqui: o backend usa a service_role key, que bypassa RLS por definição. A
separação entre usuários precisa acontecer NESTE arquivo e nos filtros por
`user_id` dos routers.

Como o token é verificado
-------------------------
O projeto usa JWT assimétrico (ES256), então a assinatura é conferida
localmente com a chave pública do JWKS do Supabase — sem round-trip ao Auth a
cada request, e sem precisar guardar nenhum segredo novo no Railway. O JWKS é
buscado uma vez e fica em cache; se aparecer um `kid` desconhecido (rotação de
chave), ele é rebuscado uma vez antes de recusar.
"""

import time
from typing import Annotated

import httpx
import jwt
from fastapi import Depends, HTTPException, Request
from jwt import PyJWKClient

from services.config import settings

# O Supabase assina o access token com `aud: "authenticated"`.
_AUDIENCE = "authenticated"

_jwks_client: PyJWKClient | None = None


def _get_jwks_client() -> PyJWKClient:
    """Cliente do JWKS, criado uma vez por processo.

    O PyJWKClient já mantém cache das chaves e rebusca sozinho quando encontra
    um `kid` que não conhece, que é o caso de rotação de chave no Supabase.
    """
    global _jwks_client
    if _jwks_client is None:
        _jwks_client = PyJWKClient(
            f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json",
            cache_keys=True,
        )
    return _jwks_client


def _bearer_token(request: Request) -> str | None:
    header = request.headers.get("Authorization") or ""
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        return None
    return token.strip()


def _decode(token: str) -> dict:
    """Valida assinatura, expiração e audience. Levanta 401 em qualquer falha."""
    try:
        signing_key = _get_jwks_client().get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience=_AUDIENCE,
            options={"require": ["exp", "sub"]},
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sessão expirada. Entre de novo.")
    except (jwt.InvalidTokenError, httpx.HTTPError, Exception) as exc:
        # Qualquer coisa que não seja um token válido cai aqui — inclusive falha
        # ao buscar o JWKS. Não vaza o motivo para o cliente.
        if isinstance(exc, HTTPException):
            raise
        raise HTTPException(status_code=401, detail="Sessão inválida. Entre de novo.")


def current_user_id(request: Request) -> str:
    """Dependency: o `auth.uid()` de quem está chamando.

    Use em TODA rota que toca dado de usuário. Sem token válido, 401 — nunca
    caia num usuário padrão, que é o que fazia o vazamento acontecer.
    """
    token = _bearer_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Autenticação necessária.")
    claims = _decode(token)
    user_id = claims.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Sessão inválida. Entre de novo.")
    return str(user_id)


UserId = Annotated[str, Depends(current_user_id)]


def require_admin(request: Request) -> str:
    """Dependency das rotas /admin. Devolve o user_id do admin.

    A lista de admins vem de ADMIN_USER_IDS (env, separada por vírgula) em vez
    de um claim no JWT: o papel precisaria ser gravado no user_metadata de cada
    conta, e user_metadata é editável pelo próprio usuário — quem quisesse ver
    o painel de custos bastaria se promover.
    """
    user_id = current_user_id(request)
    if user_id not in settings.admin_user_ids():
        raise HTTPException(status_code=403, detail="Acesso de admin requerido")
    return user_id


AdminId = Annotated[str, Depends(require_admin)]


def get_owned_professor(professor_id, user_id: str, columns: str = "*") -> dict:
    """Busca um professor GARANTINDO que ele pertence a `user_id`.

    Toda rota com `professor_id` na URL precisa passar por aqui. O id é um UUID
    que o cliente manda, e sem esta checagem bastaria conhecer (ou adivinhar) o
    id de outra pessoa para ler o material e o histórico dela — o filtro por
    dono na listagem não protege o acesso direto.

    Responde 404, e não 403, de propósito: para quem não é dono, o professor
    não existe. Um 403 confirmaria que aquele id é de alguém.
    """
    from services.supabase_client import get_supabase

    res = (
        get_supabase()
        .table("professors")
        .select(columns)
        .eq("id", str(professor_id))
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Professor não encontrado")
    return res.data[0]
