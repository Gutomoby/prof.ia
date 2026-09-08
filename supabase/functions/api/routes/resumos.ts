/*
  Resumo por módulo da trilha — RAG nos chunks daquele módulo (mesmo padrão
  de busca de atividades.ts) + Claude Haiku, tool-forced, pra um resumo
  estruturado. Guardado em `summaries` (module_id, professor_id, content —
  content é text, então guarda o JSON serializado, não jsonb).

  GET  /professores/:id/modulos/:moduleId/resumo         busca o mais recente
  POST /professores/:id/modulos/:moduleId/resumo/gerar    gera um novo
*/
import type { Router } from "../../_shared/router.ts";
import { currentUserId, getOwnedProfessor } from "../../_shared/auth.ts";
import { db } from "../../_shared/db.ts";
import { HttpError } from "../../_shared/http.ts";
import { NOTACAO_MATEMATICA, generateSummary } from "../../_shared/claude.ts";
import { normalizarProfundo } from "../../_shared/notacao.ts";
import { searchChunks } from "../../_shared/embeddings.ts";

type ModuleRow = { id: string; name: string; description: string | null; topics: string[] };

async function getModule(moduleId: string, professorId: string): Promise<ModuleRow> {
  const { data, error } = await db()
    .from("modules")
    .select("id, name, description, topics")
    .eq("id", moduleId)
    .eq("professor_id", professorId)
    .limit(1);
  if (error) throw new HttpError(500, error.message);
  if (!data || !data.length) throw new HttpError(404, "Módulo não encontrado");
  return data[0] as ModuleRow;
}

export function register(router: Router): void {
  router.get("/professores/:id/modulos/:moduleId/resumo", async (ctx) => {
    const userId = await currentUserId(ctx.req);
    const professorId = ctx.params.id;
    await getOwnedProfessor(professorId, userId, "id");
    await getModule(ctx.params.moduleId, professorId); // valida posse do módulo

    const { data, error } = await db()
      .from("summaries")
      .select("id, topic, content, created_at")
      .eq("module_id", ctx.params.moduleId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw new HttpError(500, error.message);
    if (!data || !data.length) throw new HttpError(404, "Nenhum resumo gerado ainda para este módulo");

    const row = data[0];
    return { id: row.id, topic: row.topic, created_at: row.created_at, content: normalizarProfundo(JSON.parse(row.content)) };
  });

  router.post("/professores/:id/modulos/:moduleId/resumo/gerar", async (ctx) => {
    const userId = await currentUserId(ctx.req);
    const professorId = ctx.params.id;
    const professor = await getOwnedProfessor(professorId, userId, "id, discipline, system_prompt");
    const modulo = await getModule(ctx.params.moduleId, professorId);

    const topicos = modulo.topics ?? [];
    const query = topicos.length ? `${modulo.name}: ${topicos.join(", ")}` : modulo.name;
    const chunks = await searchChunks(professorId, query, 12);
    const context = chunks.map((c) => c.content).join("\n\n---\n\n") || "(nenhum material enviado ainda)";
    const systemPrompt = ((professor.system_prompt as string) ?? "").replace("{chunks_retrieved}", context);

    const userPrompt =
      `Escreva um resumo de estudo do módulo "${modulo.name}"` +
      (topicos.length ? ` (tópicos: ${topicos.join(", ")})` : "") +
      ". Baseie-se no material de contexto do system prompt. O resumo deve ajudar o aluno a revisar rapidamente " +
      "antes de um quiz ou prova, sem substituir o material original. " +
      `${NOTACAO_MATEMATICA} ` +
      "Use a tool return_summary para responder.";

    const summary = await generateSummary(systemPrompt, userPrompt, userId, professorId);
    const conteudo = normalizarProfundo(summary);

    const { data: inserted, error } = await db()
      .from("summaries")
      .insert({
        professor_id: professorId,
        module_id: modulo.id,
        topic: modulo.name,
        content: JSON.stringify(conteudo),
      })
      .select("id, topic, created_at");
    if (error) throw new HttpError(500, error.message);
    if (!inserted || !inserted.length) throw new HttpError(500, "Falha ao salvar o resumo gerado");

    return { ...inserted[0], content: conteudo };
  });
}
