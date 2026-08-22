/*
  Rota de Atividades — porta de routers/atividades.py.

  Por enquanto só o tipo "quiz" está implementado de ponta a ponta (geração +
  correção) — mesmo estado do Python original.

  POST /atividades/gerar        pede à IA para gerar um quiz novo
  POST /atividades/conferir     corrige UMA questão, sem fechar a atividade
  POST /atividades/submeter     recebe as respostas, calcula score e salva
  GET  /atividades              lista atividades de um professor (histórico)
  GET  /atividades/:id          detalhe corrigido de uma tentativa (revisitar)
*/

import type { Router } from "../../_shared/router.ts";
import { currentUserId, getOwnedProfessor } from "../../_shared/auth.ts";
import { db } from "../../_shared/db.ts";
import { HttpError } from "../../_shared/http.ts";
import { MODEL_HAIKU, NOTACAO_MATEMATICA, generateJson } from "../../_shared/claude.ts";
import { normalizarProfundo } from "../../_shared/notacao.ts";
import { searchChunks } from "../../_shared/embeddings.ts";
import { corrigirQuestoes, type Questao } from "../../_shared/scoring.ts";
import { creditarXp, XP_ATIVIDADE_CONCLUIDA, XP_QUESTAO_CORRETA, XP_QUESTAO_ERRADA, XP_TOPICO_DOMINADO } from "../../_shared/progresso.ts";
import { statsPorTopicoDe } from "../../_shared/scoring.ts";

// deno-lint-ignore no-explicit-any
function stripAnswers(questions: any[]): any[] {
  return questions.map(({ resposta_correta: _rc, explicacao: _exp, ...resto }) => resto);
}

// A dificuldade muda o ESTILO das questões, não a matéria — o material de
// base é o mesmo; o que varia é o quanto a questão exige de raciocínio.
const _DIFFICULTY_INSTRUCTIONS: Record<string, string> = {
  facil:
    "Dificuldade FÁCIL: questões diretas de fixação, testando definições, " +
    "conceitos básicos e reconhecimento. Alternativas erradas claramente distintas.",
  medio:
    "Dificuldade MÉDIA: questões de aplicação, no nível típico de uma prova — " +
    "exigem entender o conceito e aplicá-lo a um caso simples.",
  dificil:
    "Dificuldade DIFÍCIL: questões desafiadoras que exigem raciocínio em mais " +
    "de uma etapa, casos-limite e distratores plausíveis que pegam quem decorou " +
    "sem entender. Sem pegadinhas de enunciado ambíguo — difícil pelo conteúdo.",
};

async function getModule(moduleId: string, professorId: string): Promise<{ id: string; name: string; description: string | null; topics: string[] }> {
  const { data, error } = await db()
    .from("modules")
    .select("id, name, description, topics")
    .eq("id", moduleId)
    .eq("professor_id", professorId)
    .limit(1);
  if (error) throw new HttpError(500, error.message);
  if (!data || !data.length) throw new HttpError(404, "Módulo não encontrado");
  return data[0] as { id: string; name: string; description: string | null; topics: string[] };
}

export function register(router: Router): void {
  router.post("/atividades/gerar", async (ctx) => {
    const userId = await currentUserId(ctx.req);
    const payload = await ctx.body<{
      professor_id?: unknown;
      activity_type?: unknown;
      topic?: unknown;
      module_id?: unknown;
      difficulty?: unknown;
    }>();

    if (payload.activity_type !== "quiz") {
      throw new HttpError(400, "Só o tipo 'quiz' está implementado por enquanto.");
    }
    const professorId = payload.professor_id as string;
    const professor = await getOwnedProfessor(professorId, userId, "id, discipline, system_prompt");
    const difficulty = (payload.difficulty as string) || "medio";
    if (!(difficulty in _DIFFICULTY_INSTRUCTIONS)) {
      throw new HttpError(400, "difficulty precisa ser facil, medio ou dificil.");
    }

    const moduleId = payload.module_id as string | undefined;
    const module = moduleId ? await getModule(moduleId, professorId) : null;

    let query: string;
    let scopeDesc: string;
    let nQuestoes: string;
    let topicLabel: string | null;

    if (module) {
      // Quiz do módulo inteiro: busca material pelos tópicos do capítulo.
      const topics = module.topics ?? [];
      query = topics.length ? `${module.name}: ${topics.join(", ")}` : module.name;
      scopeDesc = `cobrindo o módulo inteiro "${module.name}"` + (topics.length ? ` (tópicos: ${topics.join(", ")})` : "");
      nQuestoes = "8 a 10";
      topicLabel = module.name;
    } else {
      const topic = payload.topic as string | undefined;
      query = topic || (professor.discipline as string);
      scopeDesc = topic ? `sobre o tópico "${topic}"` : "sobre um tópico relevante do material acima";
      nQuestoes = "5 a 8";
      topicLabel = topic ?? null;
    }

    const chunks = await searchChunks(professorId, query, module ? 10 : 8);
    const context = chunks.map((c) => c.content).join("\n\n---\n\n") || "(nenhum material enviado ainda)";
    const systemPrompt = ((professor.system_prompt as string) ?? "").replace("{chunks_retrieved}", context);

    const userPrompt =
      `Gere um quiz de múltipla escolha com ${nQuestoes} questões ${scopeDesc}. ` +
      `${_DIFFICULTY_INSTRUCTIONS[difficulty]} ` +
      "Cada questão precisa ter exatamente 4 alternativas, apenas uma correta. " +
      "Baseie as questões prioritariamente no material de contexto do system prompt; " +
      "se ele não cobrir o tópico, use conhecimento geral da matéria. " +
      `${NOTACAO_MATEMATICA} ` +
      "CÁLCULOS: Se a questão envolver cálculos matemáticos, SEMPRE verifique duas vezes: " +
      "(1) execute o cálculo passo a passo, (2) confira se a resposta correta está nas alternativas. " +
      "Evite arredondar prematuramente — mantenha precisão máxima até a resposta final. " +
      "Distratores devem ser erros comuns (fórmula errada, operação errada, unidade errada), " +
      "nunca aleatórios. " +
      "Use a tool return_quiz para responder.";

    const result = await generateJson(systemPrompt, userPrompt, MODEL_HAIKU, userId, professorId);
    const questionsRaw = result.questions ?? [];
    if (!questionsRaw.length) throw new HttpError(502, "Claude não retornou nenhuma questão.");

    // A instrução NOTACAO_MATEMATICA pede LaTeX entre cifrões, mas o modelo
    // não cumpre de forma confiável — ver _shared/notacao.ts.
    const questions = normalizarProfundo(questionsRaw);

    const { data: inserted, error } = await db()
      .from("activity_results")
      .insert({
        professor_id: professorId,
        activity_type: "quiz",
        topic: topicLabel,
        questions,
        module_id: moduleId ?? null,
        difficulty,
      })
      .select();
    if (error) throw new HttpError(500, error.message);
    if (!inserted || !inserted.length) throw new HttpError(500, "Falha ao salvar a atividade gerada");
    const activity = inserted[0];

    return {
      activity_id: activity.id,
      topic: activity.topic,
      module_id: activity.module_id ?? null,
      difficulty: activity.difficulty ?? null,
      // deno-lint-ignore no-explicit-any
      questions: stripAnswers(questions as any[]),
    };
  });

  router.post("/atividades/conferir", async (ctx) => {
    await currentUserId(ctx.req);
    const payload = await ctx.body<{ activity_id?: unknown; question_index?: unknown; answer?: unknown }>();

    const { data, error } = await db()
      .from("activity_results")
      .select("id, questions, score_pct")
      .eq("id", payload.activity_id as string)
      .limit(1);
    if (error) throw new HttpError(500, error.message);
    if (!data || !data.length) throw new HttpError(404, "Atividade não encontrada");

    const questions = (data[0].questions as Questao[]) ?? [];
    const idx = payload.question_index as number;
    if (typeof idx !== "number" || idx < 0 || idx >= questions.length) {
      throw new HttpError(400, "Índice de questão inválido");
    }

    const question = questions[idx];
    const corretaIdx = question.resposta_correta;

    return {
      correta: payload.answer === corretaIdx,
      resposta_correta: corretaIdx,
      explicacao: question.explicacao || "",
    };
  });

  router.post("/atividades/submeter", async (ctx) => {
    const userId = await currentUserId(ctx.req);
    const payload = await ctx.body<{
      activity_id?: unknown;
      answers?: unknown;
      time_seconds?: unknown;
    }>();

    const { data, error } = await db()
      .from("activity_results")
      .select("id, professor_id, questions")
      .eq("id", payload.activity_id as string)
      .limit(1);
    if (error) throw new HttpError(500, error.message);
    if (!data || !data.length) throw new HttpError(404, "Atividade não encontrada");

    const professorId = data[0].professor_id as string;
    const questions = data[0].questions as Questao[];
    const answers = (payload.answers as Record<string, unknown>) ?? {};
    const { corrigidas, scorePct } = corrigirQuestoes(questions, answers);

    // Snapshot antes da correção entrar no banco, pra saber quais tópicos
    // ACABARAM de cruzar o limiar de domínio com essa tentativa.
    const antesStats = await statsPorTopicoDe(professorId);
    const dominadosAntes = new Set(antesStats.filter((t) => t.status === "dominado").map((t) => t.topico));

    const { error: erroUpdate } = await db()
      .from("activity_results")
      .update({ answers, score_pct: scorePct, time_seconds: payload.time_seconds })
      .eq("id", payload.activity_id as string);
    if (erroUpdate) throw new HttpError(500, erroUpdate.message);

    const agoraStats = await statsPorTopicoDe(professorId);
    const dominadosAgora = new Set(agoraStats.filter((t) => t.status === "dominado").map((t) => t.topico));
    const novosDominados = [...dominadosAgora].filter((t) => !dominadosAntes.has(t)).sort();

    let xpGanho = XP_ATIVIDADE_CONCLUIDA + novosDominados.length * XP_TOPICO_DOMINADO;
    for (const questao of corrigidas) {
      if (questao.correta) xpGanho += XP_QUESTAO_CORRETA;
      else if (questao.resposta_usuario !== null) xpGanho += XP_QUESTAO_ERRADA;
    }

    const progress = await creditarXp(userId, xpGanho, true);

    return {
      score_pct: scorePct,
      questions: corrigidas,
      xp_ganho: xpGanho,
      topicos_dominados: novosDominados,
      current_streak: progress.current_streak,
    };
  });

  router.get("/atividades", async (ctx) => {
    const userId = await currentUserId(ctx.req);
    const professorId = ctx.query.get("professor_id");
    if (!professorId) throw new HttpError(400, "Parâmetro \"professor_id\" é obrigatório.");
    const activityType = ctx.query.get("activity_type") ?? "quiz";

    await getOwnedProfessor(professorId, userId, "id");
    const { data, error } = await db()
      .from("activity_results")
      .select("id, topic, difficulty, score_pct, time_seconds, created_at")
      .eq("professor_id", professorId)
      .eq("activity_type", activityType)
      .order("created_at", { ascending: false });
    if (error) throw new HttpError(500, error.message);
    return { items: data ?? [] };
  });

  router.get("/atividades/:id", async (ctx) => {
    await currentUserId(ctx.req);

    const { data, error } = await db()
      .from("activity_results")
      .select("id, topic, difficulty, questions, answers, score_pct, time_seconds, created_at")
      .eq("id", ctx.params.id)
      .limit(1);
    if (error) throw new HttpError(500, error.message);
    if (!data || !data.length) throw new HttpError(404, "Atividade não encontrada");

    const row = data[0];
    if (row.score_pct === null) throw new HttpError(400, "Essa atividade ainda não foi respondida");

    const { corrigidas } = corrigirQuestoes(row.questions as Questao[], (row.answers as Record<string, unknown>) ?? {});

    return {
      id: row.id,
      topic: row.topic,
      difficulty: row.difficulty ?? null,
      score_pct: row.score_pct,
      time_seconds: row.time_seconds,
      created_at: row.created_at,
      questions: corrigidas,
    };
  });
}
