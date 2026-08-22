/*
  Rota de Score — porta de routers/score.py.

  GET  /score/:id          resumo: streak, tópicos, evolução, metas
  GET  /score/:id/plano    último plano de estudos gerado (ou 404)
  POST /score/:id/plano    gera um plano de estudos novo (IA)
*/

import type { Router } from "../../_shared/router.ts";
import { currentUserId, getOwnedProfessor } from "../../_shared/auth.ts";
import { db } from "../../_shared/db.ts";
import { HttpError } from "../../_shared/http.ts";
import { MODEL_HAIKU, NOTACAO_MATEMATICA, generateStudyPlan } from "../../_shared/claude.ts";
import { normalizarProfundo } from "../../_shared/notacao.ts";
import { searchChunks } from "../../_shared/embeddings.ts";
import {
  MASTERY_THRESHOLD_PCT,
  atividadesRespondidas,
  calcularStreak,
  paraDataLocal,
  statsPorTopico,
  statsPorTopicoDe,
  type TentativaRespondida,
} from "../../_shared/scoring.ts";

// Backslash que não inicia um escape JSON válido (caso típico: LaTeX "\ell",
// "\cdot"...). Dobrado, vira um escape válido que preserva o LaTeX original.
const _INVALID_JSON_ESCAPE = /\\(?!["\\/bfnrtu])/g;

/**
 * Garante string[] para os campos de lista do plano.
 *
 * O tool-forcing normalmente devolve arrays, mas o modelo às vezes entrega a
 * lista SERIALIZADA numa string ("[\"a\", \"b\"]"). Com LaTeX no meio a
 * string nem sempre é JSON válido (escapes tipo \e), então tenta também a
 * versão com escapes corrigidos.
 */
// deno-lint-ignore no-explicit-any
function coerceStrList(value: any): string[] {
  if (typeof value === "string") {
    let parsed: unknown = null;
    for (const candidate of [value, value.replace(_INVALID_JSON_ESCAPE, "\\\\")]) {
      try {
        parsed = JSON.parse(candidate);
        break;
      } catch {
        continue;
      }
    }
    value = Array.isArray(parsed) ? parsed : value.trim() ? [value] : [];
  }
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter((s) => s.trim());
}

/** Força o contrato do plano na fronteira — ao salvar (novo) e ao ler (antigo). */
// deno-lint-ignore no-explicit-any
function normalizePlanContent(content: any): Record<string, unknown> {
  let resumo = content?.resumo ?? "";
  if (Array.isArray(resumo)) resumo = resumo.map(String).join(" ");
  return normalizarProfundo({
    resumo: String(resumo),
    prioridades: coerceStrList(content?.prioridades),
    semana: coerceStrList(content?.semana),
    mes: coerceStrList(content?.mes),
  });
}

export function register(router: Router): void {
  router.get("/score/:id", async (ctx) => {
    const userId = await currentUserId(ctx.req);
    const professorId = ctx.params.id;
    const professor = await getOwnedProfessor(professorId, userId, "id, exam_dates");

    const now = Date.now();
    const weekAgo = now - 7 * 86400_000;
    const monthAgo = now - 30 * 86400_000;

    // Sequência e gráfico de evolução só precisam de data e nota — buscar sem
    // o JSONB `questions` evita trazer o enunciado de todo quiz respondido.
    const activities = await atividadesRespondidas(professorId, { comQuestoes: false });
    const activityDates = activities.map((a) => paraDataLocal(a.created_at));
    const scoreTrend = activities.map((a) => ({ data: a.created_at, score_pct: a.score_pct }));

    const weekActivities = activities.filter((a) => new Date(a.created_at).getTime() >= weekAgo);
    const weekly = {
      quizzes_respondidos: weekActivities.length,
      media_score_pct: weekActivities.length
        ? Math.round((weekActivities.reduce((s, a) => s + a.score_pct, 0) / weekActivities.length) * 10) / 10
        : null,
    };

    // Os dois recortes (hoje e 30 dias atrás) saem do MESMO histórico: uma
    // ida ao banco com as questões, o recorte antigo é um filtro em memória.
    const respondidas = await atividadesRespondidas(professorId);
    const topicsNow = statsPorTopico(respondidas);
    const topicsMonthAgo = statsPorTopico(
      respondidas.filter((a: TentativaRespondida) => new Date(a.created_at).getTime() < monthAgo),
    );
    const dominadosAntes = new Set(topicsMonthAgo.filter((t) => t.status === "dominado").map((t) => t.topico));
    const dominadosAgora = topicsNow.filter((t) => t.status === "dominado");
    const novosDominadosMes = dominadosAgora.filter((t) => !dominadosAntes.has(t.topico));
    const monthly = {
      topicos_dominados: novosDominadosMes.length,
      topicos_totais: dominadosAgora.length,
    };

    // Domínio da matéria = % de módulos da trilha dominados — mesma conta que
    // a trilha desenha na tela ("5 de 7"), pra número do topo e nós verdes
    // embaixo nunca discordarem.
    const { data: modulesRows, error: erroModules } = await db()
      .from("modules")
      .select("id")
      .eq("professor_id", professorId);
    if (erroModules) throw new HttpError(500, erroModules.message);
    const moduleIds = (modulesRows ?? []).map((m) => m.id as string);

    let overallMasteryPct = 0.0;
    if (moduleIds.length) {
      const { data: notasRows, error: erroNotas } = await db()
        .from("activity_results")
        .select("module_id, score_pct")
        .eq("professor_id", professorId)
        .not("module_id", "is", null)
        .not("score_pct", "is", null);
      if (erroNotas) throw new HttpError(500, erroNotas.message);

      const melhorPorModulo = new Map<string, number>();
      for (const row of notasRows ?? []) {
        const mid = row.module_id as string;
        const score = row.score_pct as number;
        if (score > (melhorPorModulo.get(mid) ?? -1)) melhorPorModulo.set(mid, score);
      }
      const dominados = moduleIds.filter((mid) => (melhorPorModulo.get(mid) ?? 0) >= MASTERY_THRESHOLD_PCT).length;
      overallMasteryPct = Math.round((dominados / moduleIds.length) * 1000) / 10;
    }

    return {
      streak_days: calcularStreak(activityDates),
      topics: topicsNow,
      score_trend: scoreTrend,
      weekly,
      monthly,
      overall_mastery_pct: overallMasteryPct,
      exam_dates: professor.exam_dates,
    };
  });

  router.get("/score/:id/plano", async (ctx) => {
    const userId = await currentUserId(ctx.req);
    const professorId = ctx.params.id;
    await getOwnedProfessor(professorId, userId, "id");

    const { data, error } = await db()
      .from("study_plans")
      .select("id, professor_id, content, created_at")
      .eq("professor_id", professorId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw new HttpError(500, error.message);
    if (!data || !data.length) throw new HttpError(404, "Nenhum plano de estudos gerado ainda");

    const row = data[0];
    row.content = normalizePlanContent(row.content ?? {});
    return row;
  });

  router.post("/score/:id/plano", async (ctx) => {
    const userId = await currentUserId(ctx.req);
    const professorId = ctx.params.id;
    const professor = await getOwnedProfessor(professorId, userId, "id, discipline, system_prompt, exam_dates");

    const topics = await statsPorTopicoDe(professorId);
    const pendentes = topics.filter((t) => t.status === "pendente").map((t) => t.topico);

    const query = pendentes.length ? pendentes[0] : (professor.discipline as string);
    const chunks = await searchChunks(professorId, query, 8);
    const context = chunks.map((c) => c.content).join("\n\n---\n\n") || "(nenhum material enviado ainda)";

    const systemPrompt = ((professor.system_prompt as string) ?? "").replace("{chunks_retrieved}", context);

    let topicosDesc: string;
    if (pendentes.length) {
      topicosDesc = `Tópicos que o aluno ainda está com dificuldade (priorize esses): ${pendentes.join(", ")}.`;
    } else if (topics.length) {
      const dominados = topics.map((t) => `${t.topico} (${t.accuracy_pct}%)`).join(", ");
      topicosDesc =
        `IMPORTANTE: o aluno JÁ TEM histórico de quiz e está indo bem — domina ${topics.length} ` +
        `de ${topics.length} tópicos testados até agora: ${dominados}. ` +
        "No campo 'resumo', comece afirmando esse bom desempenho (nunca diga que ele não tem dados " +
        "ou está começando). Sugira avançar para tópicos novos do material que ainda não foram " +
        "cobrados em quiz, ou aprofundar o nível de dificuldade dos tópicos já dominados.";
    } else {
      topicosDesc =
        "O aluno ainda não respondeu nenhum quiz — sugira um plano inicial equilibrado " +
        "cobrindo o material disponível, sem mencionar pontos fracos.";
    }
    const examDesc = professor.exam_dates
      ? `Datas de prova informadas pelo aluno: ${professor.exam_dates}.`
      : "";

    const userPrompt =
      `Monte um plano de estudos para esse aluno de ${professor.discipline}. ` +
      `${topicosDesc} ${examDesc} ` +
      `${NOTACAO_MATEMATICA} ` +
      "Use a tool return_study_plan para responder.";

    const content = normalizePlanContent(await generateStudyPlan(systemPrompt, userPrompt, MODEL_HAIKU));

    const { data: inserted, error } = await db()
      .from("study_plans")
      .insert({ professor_id: professorId, content })
      .select();
    if (error) throw new HttpError(500, error.message);
    if (!inserted || !inserted.length) throw new HttpError(500, "Falha ao salvar o plano gerado");
    return inserted[0];
  });
}
