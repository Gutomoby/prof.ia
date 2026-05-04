"""
Wrapper para chamadas à Claude API (Anthropic).

Centraliza a escolha de modelo por feature, conforme decidido:
  - Chat e Prova:                       claude-sonnet-4-20250514
  - Quiz, Simulado, Reforço, Análise:   claude-haiku-4-5-20251001

Implementação real será no item 7. Aqui só fixamos as constantes.
"""

# Modelos definidos na especificação do projeto.
# Mantenha aqui — se trocar de modelo, troca em um lugar só.
MODEL_SONNET = "claude-sonnet-4-20250514"
MODEL_HAIKU = "claude-haiku-4-5-20251001"


async def stream_chat(system_prompt: str, messages: list[dict], model: str = MODEL_SONNET):
    """Gera uma resposta em stream do Claude. Yield de tokens conforme chegam."""
    raise NotImplementedError


async def generate_json(system_prompt: str, user_prompt: str, model: str = MODEL_HAIKU) -> dict:
    """Pede ao Claude uma resposta em JSON estruturado (para gerar atividades)."""
    raise NotImplementedError
