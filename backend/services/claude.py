"""
Wrapper para chamadas à Claude API (Anthropic) e Google Gemini API.

Centraliza a escolha de modelo por feature:
  - Módulos (qualidade):           claude-sonnet-5
  - Quiz (custo ultra-baixo):      gemini-2.0-flash (com fallback a haiku)
  - Simulado, Reforço, Análise:    claude-haiku-4-5-20251001
  - Plano de estudos (qualidade):  claude-haiku-4-5-20251001

Nota: Quiz usa Gemini por padrão quando GEMINI_API_KEY está configurada.
      Em caso de erro na chamada ao Gemini, cai automaticamente para Haiku.
      Sem GEMINI_API_KEY, vai direto para Haiku.
"""

from functools import lru_cache
from datetime import datetime

from anthropic import Anthropic
import google.generativeai as genai

from services.config import settings
from services.supabase_client import get_supabase

# Modelos do projeto. Mantenha aqui — se trocar de modelo, troca em um lugar só.
# claude-sonnet-4-20250514 saiu do ar (404 na API) — substituído pelo Sonnet 5.
MODEL_SONNET = "claude-sonnet-5"
MODEL_HAIKU = "claude-haiku-4-5-20251001"
MODEL_GEMINI = "gemini-2.0-flash"


@lru_cache(maxsize=1)
def _get_client() -> Anthropic:
    """Cliente Anthropic — carregado uma vez por processo (mesmo padrão do embedder em rag.py)."""
    return Anthropic(api_key=settings.ANTHROPIC_API_KEY)


@lru_cache(maxsize=1)
def _get_gemini_client():
    """Cliente Google Gemini — carregado uma vez por processo."""
    if not settings.GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY não configurada no ambiente")
    genai.configure(api_key=settings.GEMINI_API_KEY)
    return genai.GenerativeModel(MODEL_GEMINI)


def _model_key(model: str) -> str:
    """Normaliza nome do modelo para a chave curta usada em token_logs e estimativa de custo."""
    model_lower = model.lower()
    if "haiku" in model_lower:
        return "haiku"
    elif "sonnet" in model_lower:
        return "sonnet"
    elif "gemini" in model_lower:
        return "gemini"
    return "haiku"  # fallback seguro


def _log_token_usage(
    user_id: str,
    professor_id: str,
    model: str,
    operation: str,
    tokens_in: int,
    tokens_out: int,
    cost_usd: float,
) -> None:
    """Registra consumo de tokens em token_logs para billing intelligence."""
    try:
        sb = get_supabase()
        sb.table("token_logs").insert({
            "user_id": user_id,
            "professor_id": professor_id,
            "model": model,
            "operation": operation,
            "tokens_in": tokens_in,
            "tokens_out": tokens_out,
            "cost_usd": cost_usd,
            "created_at": datetime.utcnow().isoformat(),
        }).execute()
    except Exception as e:
        # Log não é crítico — se falhar, a operação de IA continua
        print(f"Aviso: falha ao registrar token_log: {e}")


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


# Schema da tool para organizar o material em módulos (capítulos).
_MODULES_TOOL = {
    "name": "return_modules",
    "description": "Retorna os módulos (capítulos) em que o material foi organizado.",
    "input_schema": {
        "type": "object",
        "properties": {
            "modules": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {
                            "type": "string",
                            "description": "Título curto do módulo, como um capítulo de livro.",
                        },
                        "description": {
                            "type": "string",
                            "description": "1-2 frases sobre o que o módulo cobre.",
                        },
                        "topics": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "3-8 tópicos específicos cobertos pelo módulo.",
                        },
                    },
                    "required": ["name", "description", "topics"],
                },
            }
        },
        "required": ["modules"],
    },
}


# Notação matemática — regra única para tudo que a IA escreve e a tela mostra.
#
# O frontend renderiza LaTeX com KaTeX (components/ui/math-text.tsx), mas só
# dentro de cifrões. Sem esta instrução o modelo alternava três notações, às
# vezes na mesma frase: Unicode ("qₓ", "ℓ₄₀"), ASCII ("A_x^(m)", "A-barra_x") e
# expoente cru ("(1-qₓ)^t"). As duas últimas apareciam literais na tela.
#
# Medido no material de Atuária em produção antes da regra: de 53 tópicos de
# módulo, 28 vinham em notação tipo-LaTeX solta e 6 em Unicode.
NOTACAO_MATEMATICA = (
    "NOTAÇÃO MATEMÁTICA: escreva toda fórmula, variável com índice e expoente "
    "em LaTeX entre cifrões — $q_x$, $_tp_x$, $\\bar{A}_x$, $A_x^{(m)}$, "
    "$\\mu_{x+t}$, $\\ell_x$, $\\delta$, $\\int_0^1 f(t)\\,dt$. "
    "Vale também no meio de frase: 'a força $\\mu_{x+t}$ cresce'. "
    "NUNCA use subscrito ou sobrescrito em Unicode (qₓ, ℓ₄₀, ᵗ), nem _ ou ^ "
    "fora dos cifrões, nem 'barra' escrito por extenso. "
    "Texto comum fica fora dos cifrões."
)


def generate_modules(system_prompt: str, user_prompt: str, model: str = MODEL_SONNET) -> dict:
    """Pede ao Claude a divisão do material em módulos, via tool-forcing.

    Usa Sonnet por padrão: acontece raramente (só quando o usuário reorganiza)
    e a qualidade da divisão define a experiência de estudo inteira.
    Retorna o dict com a chave "modules" (ver _MODULES_TOOL para o schema).
    """
    client = _get_client()
    response = client.messages.create(
        model=model,
        max_tokens=8192,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}],
        tools=[_MODULES_TOOL],
        tool_choice={"type": "tool", "name": "return_modules"},
    )

    for block in response.content:
        if block.type == "tool_use" and block.name == "return_modules":
            return block.input

    raise RuntimeError("Claude não retornou os módulos no formato esperado.")


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


def generate_json(
    system_prompt: str,
    user_prompt: str,
    model: str = MODEL_HAIKU,
    user_id: str = None,
    professor_id: str = None,
) -> dict:
    """Pede a Gemini (com fallback a Claude) um quiz em JSON estruturado.

    Estratégia: Gemini por padrão (quando GEMINI_API_KEY está configurada),
    com fallback silencioso para Haiku se falhar. Sem a chave, vai direto para Haiku.

    Retorna o dict com a chave "questions" (ver _QUIZ_TOOL para o schema).
    """
    # Tentar Gemini se a chave estiver configurada
    if settings.GEMINI_API_KEY:
        try:
            return _generate_json_gemini(system_prompt, user_prompt, user_id, professor_id)
        except Exception as e:
            print(f"Aviso: falha ao chamar Gemini, caindo para Haiku: {e}")
            # Cai automaticamente para o código abaixo (Haiku)

    # Fallback para Haiku (ou rota padrão se não há chave Gemini)
    return _generate_json_claude(system_prompt, user_prompt, MODEL_HAIKU, user_id, professor_id)


def _generate_json_claude(
    system_prompt: str,
    user_prompt: str,
    model: str,
    user_id: str = None,
    professor_id: str = None,
) -> dict:
    """Chamada a Claude via Anthropic API."""
    client = _get_client()
    # 8192: um quiz de módulo (8-10 questões com explicação) não cabe em 4096
    # e o corte no meio da tool devolvia input vazio ("nenhuma questão").
    response = client.messages.create(
        model=model,
        max_tokens=8192,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}],
        tools=[_QUIZ_TOOL],
        tool_choice={"type": "tool", "name": "return_quiz"},
    )

    # Log de tokens (se user_id/professor_id fornecidos)
    if user_id and professor_id:
        tokens_in = response.usage.input_tokens
        tokens_out = response.usage.output_tokens
        cost = _estimate_cost(model, tokens_in, tokens_out)
        _log_token_usage(user_id, professor_id, _model_key(model), "quiz", tokens_in, tokens_out, cost)

    for block in response.content:
        if block.type == "tool_use" and block.name == "return_quiz":
            return block.input

    raise RuntimeError("Claude não retornou o quiz no formato esperado.")


def _generate_json_gemini(
    system_prompt: str,
    user_prompt: str,
    user_id: str = None,
    professor_id: str = None,
) -> dict:
    """Chamada a Gemini via Google GenerativeAI API."""
    import json

    client = _get_gemini_client()

    # Gemini não tem tool-forcing nativo, então pedimos JSON direto
    prompt_with_schema = f"""{system_prompt}

{user_prompt}

Responda **APENAS** em JSON válido (sem markdown, sem "```json") com a seguinte estrutura:
{json.dumps({
    "questions": [
        {
            "topico": "string",
            "enunciado": "string",
            "alternativas": ["string", "string", "string", "string"],
            "resposta_correta": 0,
            "explicacao": "string"
        }
    ]
}, indent=2)}"""

    response = client.generate_content(
        prompt_with_schema,
        generation_config=genai.types.GenerationConfig(max_output_tokens=8192),
    )

    # Log de tokens (se user_id/professor_id fornecidos)
    if user_id and professor_id:
        tokens_in = response.usage_metadata.prompt_token_count
        tokens_out = response.usage_metadata.candidates_token_count
        cost = _estimate_cost(MODEL_GEMINI, tokens_in, tokens_out)
        _log_token_usage(user_id, professor_id, "gemini", "quiz", tokens_in, tokens_out, cost)

    # Parse da resposta JSON — tolerante a cercas Markdown
    text = response.text.strip()
    # Stripar ```json ... ``` se Gemini devolveu com cercas
    if text.startswith("```json"):
        text = text[7:]  # remove ```json
    elif text.startswith("```"):
        text = text[3:]  # remove ```
    if text.endswith("```"):
        text = text[:-3]  # remove ```
    text = text.strip()

    try:
        result = json.loads(text)
        if "questions" in result:
            return result
    except (json.JSONDecodeError, AttributeError):
        pass

    raise RuntimeError("Gemini não retornou o quiz no formato JSON esperado.")


def _estimate_cost(model: str, tokens_in: int, tokens_out: int) -> float:
    """Estima o custo em USD baseado no modelo e tokens."""
    # Preços por 1M tokens (janeiro 2026)
    pricing = {
        "haiku": {"in": 0.80, "out": 4.00},
        "sonnet": {"in": 3.00, "out": 15.00},
        "gemini": {"in": 0.075, "out": 0.30},
    }

    key = _model_key(model)
    if key not in pricing:
        return 0.0

    price_in = pricing[key]["in"]
    price_out = pricing[key]["out"]
    return (tokens_in * price_in + tokens_out * price_out) / 1_000_000


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
