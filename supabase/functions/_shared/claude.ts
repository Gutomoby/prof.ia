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
import { alertarCreditoAnthropicBaixo, eErroDeCreditoAnthropic } from "./alertas.ts";

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
  resourceId?: string,
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
      resource_id: resourceId ?? null,
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
    const corpo = await res.text();
    if (eErroDeCreditoAnthropic(corpo)) {
      // Espera terminar de propósito: sem isso a function pode ser encerrada
      // antes do fetch pro Resend completar (não há waitUntil aqui). A
      // função em si nunca lança — só loga e desiste em caso de falha.
      await alertarCreditoAnthropicBaixo(corpo);
    }
    throw new Error(`Anthropic API ${res.status}: ${corpo}`);
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
            // Vem ANTES de resposta_correta de propósito — a tool call é gerada
            // em ordem, campo por campo, sem volta. Se o cálculo (e o dobro-check
            // que CÁLCULOS pede) só acontecesse depois, dentro de "explicacao", o
            // modelo podia descobrir o erro tarde demais e não ter como corrigir
            // o índice já escrito (visto em produção: resposta_correta apontando
            // pra uma alternativa, e "explicacao" recalculando, admitindo o erro
            // e concluindo outra resposta — o aluno via as duas coisas contraditórias).
            raciocinio: {
              type: "string",
              description:
                "Rascunho interno, NUNCA mostrado ao aluno. Se a questão envolver cálculo, resolva aqui " +
                "passo a passo e confira contra as alternativas ANTES de decidir resposta_correta — é aqui " +
                "que o dobro-check acontece, não em 'explicacao'. Uma vez escrita, resposta_correta é final.",
            },
            resposta_correta: {
              type: "integer",
              description: "Índice (0-3) da alternativa correta em `alternativas`.",
            },
            explicacao: {
              type: "string",
              description:
                "Explicação didática FINAL da resposta correta, em tom de professor pro aluno — texto limpo, " +
                "sem rascunho, sem \"espera\", \"recalculando\" ou menção a erro de geração anterior. Só a " +
                "explicação de por que resposta_correta está certa.",
            },
          },
          required: ["topico", "enunciado", "alternativas", "raciocinio", "resposta_correta", "explicacao"],
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
      // Vem ANTES de pontos_principais de propósito: a tool call é gerada campo
      // a campo, em ordem, e com max_tokens apertado (3072) um módulo com
      // muito subtema estourava o limite bem no meio da geração — visto em
      // produção, tokens_out batendo exatamente no teto e conteudo saindo
      // vazio ("" em vez do corpo do resumo), com o aluno só vendo a lista de
      // pontos-chave e nada abaixo dela. Subimos o limite (ver max_tokens
      // abaixo), mas se algum módulo ainda for grande o bastante pra estourar
      // de novo, é melhor perder os pontos-chave (redundantes com o corpo) do
      // que perder o corpo inteiro.
      conteudo: {
        type: "string",
        description:
          "Corpo do resumo cobrindo os conceitos do módulo com exemplos quando fizer sentido. Pode (e deve, " +
          "quando o conteúdo tiver mais de um subtema) usar Markdown leve para organizar: ## para título de " +
          "seção, listas com \"- \" ou \"1. \", **negrito** para termo-chave, e uma linha só com --- para " +
          "separar blocos bem distintos. Nada além disso (sem link, sem tabela).",
      },
      pontos_principais: {
        type: "array",
        items: { type: "string" },
        description: "3 a 6 pontos-chave, cada um 1-2 frases — o que não pode faltar na cabeça do aluno.",
      },
    },
    required: ["titulo", "conteudo", "pontos_principais"],
  },
};

export type Summary = { titulo: string; pontos_principais: string[]; conteudo: string };

/** Pede ao Claude um resumo estruturado do módulo, via tool-forcing. */
export async function generateSummary(
  systemPrompt: string,
  userPrompt: string,
  userId?: string,
  professorId?: string,
  resourceId?: string,
): Promise<Summary> {
  const response = await anthropicMessages({
    model: MODEL_HAIKU,
    // 3072 era curto demais pra módulo com muito subtema — ver comentário
    // em _SUMMARY_TOOL.conteudo. 8192 é o mesmo teto já usado pra quiz
    // (generateJsonClaude), sem custo relevante a mais (Haiku output é barato).
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
    tools: [_SUMMARY_TOOL],
    tool_choice: { type: "tool", name: "return_summary" },
  });

  if (userId && professorId) {
    const tokensIn = response.usage.input_tokens;
    const tokensOut = response.usage.output_tokens;
    const cost = estimateCost(MODEL_HAIKU, tokensIn, tokensOut);
    await logTokenUsage(userId, professorId, "haiku", "resumo", tokensIn, tokensOut, cost, resourceId);
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
  resourceId?: string,
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
  await logTokenUsage(userId, professorId, "haiku", "chat", tokensIn, tokensOut, cost, resourceId);

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
  operation: string = "quiz",
  resourceId?: string,
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
    await logTokenUsage(userId, professorId, modelKey(model), operation, tokensIn, tokensOut, cost, resourceId);
  }

  const input = toolInput(response, "return_quiz");
  if (!input) throw new Error("Claude não retornou o quiz no formato esperado.");
  return input as { questions: unknown[] };
}

/**
 * Pede ao Claude (Haiku) um quiz ou prova em JSON estruturado, via tool-forcing.
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
  // "quiz" ou "prova" — antes disto existir, toda geração (inclusive prova)
  // era logada como "quiz" em token_logs, então dava pra separar o custo de
  // uma coisa da outra nos relatórios financeiros.
  operation: string = "quiz",
  resourceId?: string,
): Promise<{ questions: unknown[] }> {
  return await generateJsonClaude(systemPrompt, userPrompt, MODEL_HAIKU, userId, professorId, operation, resourceId);
}
