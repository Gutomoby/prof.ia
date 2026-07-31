"""
Wrapper para chamadas à Claude API (Anthropic).

Centraliza a escolha de modelo por feature, conforme decidido:
  - Chat e Prova:                       claude-sonnet-4-20250514
  - Quiz, Simulado, Reforço, Análise:   claude-haiku-4-5-20251001
"""

from functools import lru_cache

from anthropic import Anthropic

from services.config import settings

# Modelos definidos na especificação do projeto.
# Mantenha aqui — se trocar de modelo, troca em um lugar só.
MODEL_SONNET = "claude-sonnet-4-20250514"
MODEL_HAIKU = "claude-haiku-4-5-20251001"


@lru_cache(maxsize=1)
def _get_client() -> Anthropic:
    """Cliente Anthropic — carregado uma vez por processo (mesmo padrão do embedder em rag.py)."""
    return Anthropic(api_key=settings.ANTHROPIC_API_KEY)


# Schema da tool usada para forçar o Claude a responder em JSON estruturado.
# Tool-forcing é mais confiável do que pedir "responda em JSON" em texto livre.
_QUIZ_TOOL = {
    "name": "return_quiz",
    "description": "Retorna as questões do quiz geradas.",
    "input_schema": {
        "type": "object",
        "properties": {
            "questions": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "topico": {"type": "string", "description": "Tema específico da questão."},
                        "enunciado": {"type": "string"},
                        "alternativas": {
                            "type": "array",
                            "items": {"type": "string"},
                            "minItems": 4,
                            "maxItems": 4,
                        },
                        "resposta_correta": {
                            "type": "integer",
                            "description": "Índice (0-3) da alternativa correta em `alternativas`.",
                        },
                        "explicacao": {
                            "type": "string",
                            "description": "Explicação didática da resposta correta.",
                        },
                    },
                    "required": ["topico", "enunciado", "alternativas", "resposta_correta", "explicacao"],
                },
            }
        },
        "required": ["questions"],
    },
}


# Schema da tool para o plano de estudos — mesma técnica de tool-forcing do quiz.
_STUDY_PLAN_TOOL = {
    "name": "return_study_plan",
    "description": "Retorna o plano de estudos gerado.",
    "input_schema": {
        "type": "object",
        "properties": {
            "resumo": {
                "type": "string",
                "description": "1-2 frases resumindo a situação atual do aluno nessa matéria.",
            },
            "prioridades": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Tópicos fracos/pendentes que merecem mais atenção agora, em ordem de prioridade.",
            },
            "semana": {
                "type": "array",
                "items": {"type": "string"},
                "description": "3-5 ações concretas e específicas sugeridas para esta semana.",
            },
            "mes": {
                "type": "array",
                "items": {"type": "string"},
                "description": "2-4 objetivos mais amplos sugeridos para o mês.",
            },
        },
        "required": ["resumo", "prioridades", "semana", "mes"],
    },
}


async def stream_chat(system_prompt: str, messages: list[dict], model: str = MODEL_SONNET):
    """Gera uma resposta em stream do Claude. Yield de tokens conforme chegam."""
    raise NotImplementedError


def generate_json(system_prompt: str, user_prompt: str, model: str = MODEL_HAIKU) -> dict:
    """Pede ao Claude um quiz em JSON estruturado, via tool-forcing.

    Retorna o dict com a chave "questions" (ver _QUIZ_TOOL para o schema).
    """
    client = _get_client()
    response = client.messages.create(
        model=model,
        max_tokens=4096,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}],
        tools=[_QUIZ_TOOL],
        tool_choice={"type": "tool", "name": "return_quiz"},
    )

    for block in response.content:
        if block.type == "tool_use" and block.name == "return_quiz":
            return block.input

    raise RuntimeError("Claude não retornou o quiz no formato esperado.")


def generate_study_plan(system_prompt: str, user_prompt: str, model: str = MODEL_HAIKU) -> dict:
    """Pede ao Claude um plano de estudos em JSON estruturado, via tool-forcing.

    Retorna o dict com as chaves "resumo", "prioridades", "semana", "mes"
    (ver _STUDY_PLAN_TOOL para o schema).
    """
    client = _get_client()
    response = client.messages.create(
        model=model,
        max_tokens=2048,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}],
        tools=[_STUDY_PLAN_TOOL],
        tool_choice={"type": "tool", "name": "return_study_plan"},
    )

    for block in response.content:
        if block.type == "tool_use" and block.name == "return_study_plan":
            return block.input

    raise RuntimeError("Claude não retornou o plano no formato esperado.")
