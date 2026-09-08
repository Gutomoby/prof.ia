/*
  Wrapper para chamadas à Claude API (Anthropic).
  Porta de services/claude.py.

  Quiz e plano de estudos usam claude-haiku-4-5-20251001. Já existiu um
  caminho de quiz via Gemini (gemini-2.0-flash, ~10x mais barato por token)
  com fallback a Haiku — removido em 2026-09-07 porque o Google desativou
  esse modelo em 01/06/2026 e o substituto atual (gemini-3.8-flash) custa
  quase o mesmo que o Haiku ($0.75/$3.75 vs $0.80/$4.00 por 1M), sem
  vantagem de custo que justifique manter dois provedores e o parsing
  manual de JSON que isso exigia (Gemini não tem tool-forcing nativo).

  Geração de módulos (claude-sonnet-5) roda no Cloud Run, não aqui — ver
  gcp/pdf-processor/main.py::generate_modules e o comentário em
  api/routes/modulos.ts.

  Chamadas via fetch direto à API REST — sem SDK, para manter a Edge
  Function leve e sem surpresa de compatibilidade Deno/npm.
*/

import { db } from "./db.ts";

export const MODEL_HAIKU = "claude-haiku-4-5-20251001";

function modelKey(model: string): "haiku" | "sonnet" {
  return model.toLowerCase().includes("sonnet") ? "sonnet" : "haiku";
}

// Preços por 1M tokens (janeiro 2026) — mesma tabela de services/claude.py.
const _PRICING: Record<string, { in: number; out: number }> = {
  haiku: { in: 0.8, out: 4.0 },
  sonnet: { in: 3.0, out: 15.0 },
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
type AnthropicText = { type: "text"; text: string };
type AnthropicResponse = {
  content: (AnthropicToolUse | AnthropicText | { type: string })[];
  usage: { input_tokens: number; output_tokens: number };
};

async function anthropicMessages(body: {
  model: string;
  max_tokens: number;
  system: string;
  messages: { role: string; content: string }[];
  tools?: unknown[];
  tool_choice?: { type: "tool"; name: string };
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

const _SUMMARY_TOOL = {
  name: "return_summary",
  description: "Retorna o resumo estruturado do módulo.",
  input_schema: {
    type: "object",
    properties: {
      titulo: { type: "string", description: "Título curto do resumo (pode repetir o nome do módulo)." },
      pontos_principais: {
        type: "array",
        items: { type: "string" },
        description: "3 a 6 pontos-chave, cada um 1-2 frases — o que não pode faltar na cabeça do aluno.",
      },
      conteudo: {
        type: "string",
        description:
          "Corpo do resumo em prosa, 2-4 parágrafos, cobrindo os conceitos do módulo com exemplos quando fizer sentido.",
      },
    },
    required: ["titulo", "pontos_principais", "conteudo"],
  },
};

export type Summary = { titulo: string; pontos_principais: string[]; conteudo: string };

/** Pede ao Claude um resumo estruturado do módulo, via tool-forcing. */
export async function generateSummary(
  systemPrompt: string,
  userPrompt: string,
  userId?: string,
  professorId?: string,
): Promise<Summary> {
  const response = await anthropicMessages({
    model: MODEL_HAIKU,
    max_tokens: 3072,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
    tools: [_SUMMARY_TOOL],
    tool_choice: { type: "tool", name: "return_summary" },
  });

  if (userId && professorId) {
    const tokensIn = response.usage.input_tokens;
    const tokensOut = response.usage.output_tokens;
    const cost = estimateCost(MODEL_HAIKU, tokensIn, tokensOut);
    await logTokenUsage(userId, professorId, "haiku", "resumo", tokensIn, tokensOut, cost);
  }

  const input = toolInput(response, "return_summary");
  if (!input) throw new Error("Claude não retornou o resumo no formato esperado.");
  return input as Summary;
}

/**
 * Uma resposta de chat com o professor — sem tool-forcing, texto livre.
 * `history` já inclui a mensagem nova do usuário como último item.
 */
export async function generateChatReply(
  systemPrompt: string,
  history: { role: "user" | "assistant"; content: string }[],
  userId: string,
  professorId: string,
): Promise<string> {
  const response = await anthropicMessages({
    model: MODEL_HAIKU,
    max_tokens: 1024,
    system: systemPrompt,
    messages: history,
  });

  const tokensIn = response.usage.input_tokens;
  const tokensOut = response.usage.output_tokens;
  const cost = estimateCost(MODEL_HAIKU, tokensIn, tokensOut);
  await logTokenUsage(userId, professorId, "haiku", "chat", tokensIn, tokensOut, cost);

  const bloco = response.content.find((b): b is AnthropicText => b.type === "text");
  if (!bloco) throw new Error("Claude não retornou texto na resposta do chat.");
  return bloco.text;
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

/**
 * Pede ao Claude (Haiku) um quiz em JSON estruturado, via tool-forcing.
 *
 * Já existiu uma tentativa de gerar via Gemini primeiro — ver o histórico do
 * arquivo se precisar entender o porquê de ter sido removida.
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
  return await generateJsonClaude(systemPrompt, userPrompt, MODEL_HAIKU, userId, professorId);
}
