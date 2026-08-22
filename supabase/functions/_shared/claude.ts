/*
  Wrapper para chamadas à Claude API (Anthropic) e Google Gemini API.
  Porta de services/claude.py.

  Centraliza a escolha de modelo por feature:
    - Módulos (qualidade):           claude-sonnet-5
    - Quiz (custo ultra-baixo):      gemini-2.0-flash (com fallback a haiku)
    - Plano de estudos (qualidade):  claude-haiku-4-5-20251001

  Chamadas via fetch direto às APIs REST — sem SDK, para manter a Edge
  Function leve e sem surpresa de compatibilidade Deno/npm.
*/

import { db } from "./db.ts";

export const MODEL_SONNET = "claude-sonnet-5";
export const MODEL_HAIKU = "claude-haiku-4-5-20251001";
export const MODEL_GEMINI = "gemini-2.0-flash";

function modelKey(model: string): "haiku" | "sonnet" | "gemini" {
  const m = model.toLowerCase();
  if (m.includes("haiku")) return "haiku";
  if (m.includes("sonnet")) return "sonnet";
  if (m.includes("gemini")) return "gemini";
  return "haiku";
}

// Preços por 1M tokens (janeiro 2026) — mesma tabela de services/claude.py.
const _PRICING: Record<string, { in: number; out: number }> = {
  haiku: { in: 0.8, out: 4.0 },
  sonnet: { in: 3.0, out: 15.0 },
  gemini: { in: 0.075, out: 0.3 },
};

function estimateCost(model: string, tokensIn: number, tokensOut: number): number {
  const key = modelKey(model);
  const preco = _PRICING[key];
  if (!preco) return 0;
  return (tokensIn * preco.in + tokensOut * preco.out) / 1_000_000;
}

async function logTokenUsage(
  userId: string,
  professorId: string,
  model: string,
  operation: string,
  tokensIn: number,
  tokensOut: number,
  costUsd: number,
): Promise<void> {
  try {
    const { error } = await db().from("token_logs").insert({
      user_id: userId,
      professor_id: professorId,
      model,
      operation,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      cost_usd: costUsd,
      created_at: new Date().toISOString(),
    });
    if (error) console.error("Aviso: falha ao registrar token_log:", error.message);
  } catch (e) {
    // Log não é crítico — se falhar, a operação de IA continua.
    console.error("Aviso: falha ao registrar token_log:", e);
  }
}

// Notação matemática — regra única para tudo que a IA escreve e a tela mostra.
// Mesmo texto de services/claude.py — ver ali as métricas de produção que a
// motivaram.
export const NOTACAO_MATEMATICA =
  "NOTAÇÃO MATEMÁTICA OBRIGATÓRIA: " +
  "1. TODA fórmula, variável com índice/expoente deve estar em LaTeX puro entre $ e $ " +
  "2. Exemplos CORRETOS: $q_x$, $_tp_x$, $\\bar{A}_x$, $A_x^{(m)}$, $\\mu_{x+t}$, $\\ell_x$, $\\delta$, $\\int_0^1 f(t)\\,dt$ " +
  "3. Use $ corretamente: 'a força $\\mu_{x+t}$ cresce' (no meio de frase também) " +
  "4. PROIBIDO: subscrito Unicode (qₓ, ℓ₄₀), sobrescrito Unicode (ᵗ, ²), underscore/acento fora de $ " +
  "5. LaTeX deve estar COMPLETO e VÁLIDO — sem quebras de linha, sem misturar notações " +
  "6. Quando escrever fórmula complexa, mantenha tudo entre os mesmos $ ... $ " +
  "7. Teste mentalmente: se copiar o texto entre $ para um compilador LaTeX, deve funcionar " +
  "NUNCA misture LaTeX com Unicode ou extensão. Texto comum fica FORA dos cifrões.";

// --- Anthropic ---------------------------------------------------------------

type AnthropicToolUse = { type: "tool_use"; name: string; input: Record<string, unknown> };
type AnthropicResponse = {
  content: (AnthropicToolUse | { type: string })[];
  usage: { input_tokens: number; output_tokens: number };
};

async function anthropicMessages(body: {
  model: string;
  max_tokens: number;
  system: string;
  messages: { role: string; content: string }[];
  tools: unknown[];
  tool_choice: { type: "tool"; name: string };
}): Promise<AnthropicResponse> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada no ambiente");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
  }
  return await res.json();
}

function toolInput(response: AnthropicResponse, toolName: string): Record<string, unknown> | null {
  for (const block of response.content) {
    if (block.type === "tool_use" && (block as AnthropicToolUse).name === toolName) {
      return (block as AnthropicToolUse).input;
    }
  }
  return null;
}

// Schema da tool usada para forçar o Claude a responder em JSON estruturado —
// mesmo schema de _QUIZ_TOOL em services/claude.py.
const _QUIZ_TOOL = {
  name: "return_quiz",
  description: "Retorna as questões do quiz geradas.",
  input_schema: {
    type: "object",
    properties: {
      questions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            topico: { type: "string", description: "Tema específico da questão." },
            enunciado: { type: "string" },
            alternativas: {
              type: "array",
              items: { type: "string" },
              minItems: 4,
              maxItems: 4,
            },
            resposta_correta: {
              type: "integer",
              description: "Índice (0-3) da alternativa correta em `alternativas`.",
            },
            explicacao: { type: "string", description: "Explicação didática da resposta correta." },
          },
          required: ["topico", "enunciado", "alternativas", "resposta_correta", "explicacao"],
        },
      },
    },
    required: ["questions"],
  },
};

const _MODULES_TOOL = {
  name: "return_modules",
  description: "Retorna os módulos (capítulos) em que o material foi organizado.",
  input_schema: {
    type: "object",
    properties: {
      modules: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Título curto do módulo, como um capítulo de livro." },
            description: { type: "string", description: "1-2 frases sobre o que o módulo cobre." },
            topics: {
              type: "array",
              items: { type: "string" },
              description: "3-8 tópicos específicos cobertos pelo módulo.",
            },
          },
          required: ["name", "description", "topics"],
        },
      },
    },
    required: ["modules"],
  },
};

const _STUDY_PLAN_TOOL = {
  name: "return_study_plan",
  description: "Retorna o plano de estudos gerado.",
  input_schema: {
    type: "object",
    properties: {
      resumo: { type: "string", description: "1-2 frases resumindo a situação atual do aluno nessa matéria." },
      prioridades: {
        type: "array",
        items: { type: "string" },
        description: "Tópicos fracos/pendentes que merecem mais atenção agora, em ordem de prioridade.",
      },
      semana: {
        type: "array",
        items: { type: "string" },
        description: "3-5 ações concretas e específicas sugeridas para esta semana.",
      },
      mes: {
        type: "array",
        items: { type: "string" },
        description: "2-4 objetivos mais amplos sugeridos para o mês.",
      },
    },
    required: ["resumo", "prioridades", "semana", "mes"],
  },
};

/** Pede ao Claude a divisão do material em módulos, via tool-forcing. */
export async function generateModules(
  systemPrompt: string,
  userPrompt: string,
  model: string = MODEL_SONNET,
): Promise<{ modules: unknown[] }> {
  const response = await anthropicMessages({
    model,
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
    tools: [_MODULES_TOOL],
    tool_choice: { type: "tool", name: "return_modules" },
  });
  const input = toolInput(response, "return_modules");
  if (!input) throw new Error("Claude não retornou os módulos no formato esperado.");
  return input as { modules: unknown[] };
}

/** Pede ao Claude um plano de estudos em JSON estruturado, via tool-forcing. */
export async function generateStudyPlan(
  systemPrompt: string,
  userPrompt: string,
  model: string = MODEL_HAIKU,
): Promise<Record<string, unknown>> {
  const response = await anthropicMessages({
    model,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
    tools: [_STUDY_PLAN_TOOL],
    tool_choice: { type: "tool", name: "return_study_plan" },
  });
  const input = toolInput(response, "return_study_plan");
  if (!input) throw new Error("Claude não retornou o plano no formato esperado.");
  return input;
}

async function generateJsonClaude(
  systemPrompt: string,
  userPrompt: string,
  model: string,
  userId?: string,
  professorId?: string,
): Promise<{ questions: unknown[] }> {
  const response = await anthropicMessages({
    model,
    // 8192: um quiz de módulo (8-10 questões com explicação) não cabe em 4096
    // e o corte no meio da tool devolvia input vazio ("nenhuma questão").
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
    tools: [_QUIZ_TOOL],
    tool_choice: { type: "tool", name: "return_quiz" },
  });

  if (userId && professorId) {
    const tokensIn = response.usage.input_tokens;
    const tokensOut = response.usage.output_tokens;
    const cost = estimateCost(model, tokensIn, tokensOut);
    await logTokenUsage(userId, professorId, modelKey(model), "quiz", tokensIn, tokensOut, cost);
  }

  const input = toolInput(response, "return_quiz");
  if (!input) throw new Error("Claude não retornou o quiz no formato esperado.");
  return input as { questions: unknown[] };
}

async function generateJsonGemini(
  systemPrompt: string,
  userPrompt: string,
  userId?: string,
  professorId?: string,
): Promise<{ questions: unknown[] }> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY não configurada no ambiente");

  const schema = JSON.stringify(
    {
      questions: [
        {
          topico: "string",
          enunciado: "string",
          alternativas: ["string", "string", "string", "string"],
          resposta_correta: 0,
          explicacao: "string",
        },
      ],
    },
    null,
    2,
  );

  // Gemini não tem tool-forcing nativo, então pedimos JSON direto.
  const promptComSchema =
    `${systemPrompt}\n\n${userPrompt}\n\n` +
    `Responda **APENAS** em JSON válido (sem markdown, sem "\`\`\`json") com a seguinte estrutura:\n${schema}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_GEMINI}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptComSchema }] }],
        generationConfig: { maxOutputTokens: 8192 },
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini API ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const tokensIn = data.usageMetadata?.promptTokenCount ?? 0;
  const tokensOut = data.usageMetadata?.candidatesTokenCount ?? 0;

  if (userId && professorId) {
    const cost = estimateCost(MODEL_GEMINI, tokensIn, tokensOut);
    await logTokenUsage(userId, professorId, "gemini", "quiz", tokensIn, tokensOut, cost);
  }

  let text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  text = text.trim();
  // Stripar ```json ... ``` se Gemini devolveu com cercas.
  if (text.startsWith("```json")) text = text.slice(7);
  else if (text.startsWith("```")) text = text.slice(3);
  if (text.endsWith("```")) text = text.slice(0, -3);
  text = text.trim();

  try {
    const result = JSON.parse(text);
    if (result && typeof result === "object" && "questions" in result) {
      return result as { questions: unknown[] };
    }
  } catch {
    // cai no throw abaixo
  }
  throw new Error("Gemini não retornou o quiz no formato JSON esperado.");
}

/**
 * Pede a Gemini (com fallback a Claude) um quiz em JSON estruturado.
 *
 * Estratégia: Gemini por padrão (quando GEMINI_API_KEY está configurada), com
 * fallback silencioso para Haiku se falhar. Sem a chave, vai direto para Haiku.
 */
export async function generateJson(
  systemPrompt: string,
  userPrompt: string,
  // Aceito por compatibilidade de assinatura com services/claude.py, mas o
  // Python original também nunca usa este parâmetro no corpo da função — o
  // fallback Claude sempre chama com MODEL_HAIKU fixo. Fiel ao original.
  _model: string = MODEL_HAIKU,
  userId?: string,
  professorId?: string,
): Promise<{ questions: unknown[] }> {
  if (Deno.env.get("GEMINI_API_KEY")) {
    try {
      return await generateJsonGemini(systemPrompt, userPrompt, userId, professorId);
    } catch (e) {
      console.error("Aviso: falha ao chamar Gemini, caindo para Haiku:", e);
    }
  }
  return await generateJsonClaude(systemPrompt, userPrompt, MODEL_HAIKU, userId, professorId);
}
