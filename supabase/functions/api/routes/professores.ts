/*
  Rota de Professores — porta de routers/professores.py.

  POST   /professores            cria um professor (monta system_prompt no servidor)
  GET    /professores            lista os professores do usuário
  GET    /professores/:id        detalhe
  PATCH  /professores/:id        edita (remonta system_prompt)
  DELETE /professores/:id        remove (cascata em documents/chunks/sessions/results)

  NOTA sobre auth: o backend usa service_role, que bypassa RLS — a separação
  entre usuários é feita aqui, filtrando por user_id em toda query. O user_id
  vem do JWT via _shared/auth.ts, nunca do payload.
*/

import type { Router } from "../../_shared/router.ts";
import { currentUserId } from "../../_shared/auth.ts";
import { db } from "../../_shared/db.ts";
import { HttpError } from "../../_shared/http.ts";
import { resetarProgresso } from "../../_shared/progresso.ts";

// {chunks_retrieved} fica como placeholder vazio aqui — injetado em runtime,
// em cada chamada de chat/atividade, com o resultado do RAG. Guardamos no
// banco apenas a "casca" (sem chunks) para reuso.
function buildSystemPrompt(
  name: string,
  discipline: string,
  teachingStyle: string | null | undefined,
  examDates: string | null | undefined,
): string {
  const estilo = teachingStyle || "didático e claro";
  const datas = examDates || "(não informadas)";
  return `Você é ${name}, professor(a) de ${discipline}.

Estilo de ensino: ${estilo}

Datas importantes: ${datas}

Contexto do material do aluno (use como base principal das suas respostas):
{chunks_retrieved}

Instruções:
- Responda sempre com base no material acima quando relevante.
- Se a pergunta não estiver no material, use seu conhecimento geral mas avise o aluno.
- Seja ${estilo}.
- Ao gerar questões, sempre inclua o campo "topico" indicando o tema.
- Ao corrigir, explique o motivo do erro de forma didática.`;
}

type ProfessorPayload = {
  name?: unknown;
  discipline?: unknown;
  teaching_style?: unknown;
  exam_dates?: unknown;
};

function exigirTexto(payload: ProfessorPayload, campo: "name" | "discipline"): string {
  const valor = payload[campo];
  if (typeof valor !== "string") {
    throw new HttpError(400, `Campo "${campo}" é obrigatório.`);
  }
  return valor;
}

export function register(router: Router): void {
  router.post("/professores", async (ctx) => {
    const userId = await currentUserId(ctx.req);
    const payload = await ctx.body<ProfessorPayload>();

    const name = exigirTexto(payload, "name");
    const discipline = exigirTexto(payload, "discipline");
    const teachingStyle = (payload.teaching_style as string | null | undefined) ?? null;
    const examDates = (payload.exam_dates as string | null | undefined) ?? null;

    const { data, error } = await db()
      .from("professors")
      .insert({
        user_id: userId,
        name,
        discipline,
        teaching_style: teachingStyle,
        exam_dates: examDates,
        system_prompt: buildSystemPrompt(name, discipline, teachingStyle, examDates),
      })
      .select();

    if (error) throw new HttpError(500, error.message);
    if (!data || !data.length) throw new HttpError(500, "Falha ao criar professor");
    return data[0];
  });

  router.get("/professores", async (ctx) => {
    const userId = await currentUserId(ctx.req);
    const { data, error } = await db()
      .from("professors")
      .select("id, name, discipline, teaching_style, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new HttpError(500, error.message);
    return { items: data ?? [] };
  });

  router.get("/professores/:id", async (ctx) => {
    const userId = await currentUserId(ctx.req);
    const { data, error } = await db()
      .from("professors")
      .select("*")
      .eq("id", ctx.params.id)
      .eq("user_id", userId)
      .limit(1);
    if (error) throw new HttpError(500, error.message);
    if (!data || !data.length) throw new HttpError(404, "Professor não encontrado");
    return data[0];
  });

  router.patch("/professores/:id", async (ctx) => {
    const userId = await currentUserId(ctx.req);
    const payload = await ctx.body<ProfessorPayload>();

    const { data: atualRows, error: erroAtual } = await db()
      .from("professors")
      .select("name, discipline, teaching_style, exam_dates")
      .eq("id", ctx.params.id)
      .eq("user_id", userId)
      .limit(1);
    if (erroAtual) throw new HttpError(500, erroAtual.message);
    if (!atualRows || !atualRows.length) throw new HttpError(404, "Professor não encontrado");

    // Só os campos que vieram no corpo mudam — ausente mantém o valor salvo,
    // null explícito limpa de verdade (útil pra tirar a data de prova).
    const mudancas: Record<string, unknown> = {};
    for (const campo of ["name", "discipline", "teaching_style", "exam_dates"] as const) {
      if (campo in payload) mudancas[campo] = payload[campo];
    }
    if (!Object.keys(mudancas).length) throw new HttpError(400, "Nada para atualizar");

    const novo = { ...atualRows[0], ...mudancas } as {
      name: string;
      discipline: string;
      teaching_style: string | null;
      exam_dates: string | null;
    };
    if (!(novo.name ?? "").trim()) throw new HttpError(400, "O nome não pode ficar vazio");
    if (!(novo.discipline ?? "").trim()) throw new HttpError(400, "A matéria não pode ficar vazia");

    const atualizado = {
      ...novo,
      system_prompt: buildSystemPrompt(novo.name, novo.discipline, novo.teaching_style, novo.exam_dates),
    };

    const { data, error } = await db()
      .from("professors")
      .update(atualizado)
      .eq("id", ctx.params.id)
      .eq("user_id", userId)
      .select();
    if (error) throw new HttpError(500, error.message);
    if (!data || !data.length) throw new HttpError(500, "Falha ao atualizar o professor");
    return data[0];
  });

  router.delete("/professores/:id", async (ctx) => {
    const userId = await currentUserId(ctx.req);
    const { data, error } = await db()
      .from("professors")
      .delete()
      .eq("id", ctx.params.id)
      .eq("user_id", userId)
      .select();
    if (error) throw new HttpError(500, error.message);
    if (!data || !data.length) throw new HttpError(404, "Professor não encontrado");

    await resetarProgresso(userId);
    return { deleted: ctx.params.id };
  });
}
