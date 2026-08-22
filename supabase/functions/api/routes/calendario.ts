/*
  Rota de Calendário — porta de routers/calendario.py.

  GET    /calendario                  atividades respondidas + eventos numa janela
  POST   /calendario/eventos          marca um evento (prova, revisão, tarefa)
  DELETE /calendario/eventos/:id      remove um evento

  O passado vem de activity_results (o que o aluno realmente fez) e o futuro
  de calendar_events (o que ele marcou).
*/

import type { Router } from "../../_shared/router.ts";
import { currentUserId } from "../../_shared/auth.ts";
import { db } from "../../_shared/db.ts";
import { HttpError } from "../../_shared/http.ts";

const KINDS = new Set(["prova", "revisao", "tarefa", "outro"]);
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

function exigirData(valor: string | null, nome: string): string {
  if (!valor || !DATA_ISO.test(valor)) {
    throw new HttpError(400, `Parâmetro "${nome}" precisa ser uma data YYYY-MM-DD.`);
  }
  return valor;
}

type Professor = { id: string; name: string; discipline: string };

async function professoresPorId(userId: string): Promise<Map<string, Professor>> {
  const { data, error } = await db()
    .from("professors")
    .select("id, name, discipline")
    .eq("user_id", userId);
  if (error) throw new HttpError(500, error.message);
  return new Map((data ?? []).map((p) => [p.id as string, p as Professor]));
}

export function register(router: Router): void {
  router.get("/calendario", async (ctx) => {
    const userId = await currentUserId(ctx.req);
    const inicio = exigirData(ctx.query.get("inicio"), "inicio");
    const fim = exigirData(ctx.query.get("fim"), "fim");

    const professors = await professoresPorId(userId);
    const professorIds = [...professors.keys()];

    // deno-lint-ignore no-explicit-any
    let activities: any[] = [];
    if (professorIds.length) {
      // `fim` é inclusive: o filtro vai até o fim do dia, por isso o corte em 23:59:59.999999.
      const { data, error } = await db()
        .from("activity_results")
        .select("id, professor_id, topic, score_pct, created_at")
        .in("professor_id", professorIds)
        .not("score_pct", "is", null)
        .gte("created_at", inicio)
        .lt("created_at", `${fim}T23:59:59.999999+00:00`)
        .order("created_at");
      if (error) throw new HttpError(500, error.message);
      activities = (data ?? []).map((row) => {
        const professor = professors.get(row.professor_id as string);
        return {
          ...row,
          professor_name: professor?.name ?? "—",
          discipline: professor?.discipline ?? "",
        };
      });
    }

    const { data: eventRows, error: erroEventos } = await db()
      .from("calendar_events")
      .select("id, professor_id, title, kind, event_date")
      .eq("user_id", userId)
      .gte("event_date", inicio)
      .lte("event_date", fim)
      .order("event_date");
    if (erroEventos) throw new HttpError(500, erroEventos.message);

    const events = (eventRows ?? []).map((row) => ({
      ...row,
      professor_name: professors.get(row.professor_id as string)?.name ?? null,
    }));

    return { activities, events };
  });

  router.post("/calendario/eventos", async (ctx) => {
    const userId = await currentUserId(ctx.req);
    const payload = await ctx.body<{
      title?: unknown;
      kind?: unknown;
      event_date?: unknown;
      professor_id?: unknown;
    }>();

    if (typeof payload.title !== "string" || !payload.title.trim()) {
      throw new HttpError(400, "Campo \"title\" é obrigatório.");
    }
    const eventDate = exigirData((payload.event_date as string) ?? null, "event_date");
    const kind = (payload.kind as string | undefined) ?? "outro";
    if (!KINDS.has(kind)) {
      throw new HttpError(400, `"kind" precisa ser um de: ${[...KINDS].join(", ")}.`);
    }
    const professorId = (payload.professor_id as string | null | undefined) ?? null;

    if (professorId !== null) {
      const professors = await professoresPorId(userId);
      if (!professors.has(professorId)) throw new HttpError(404, "Professor não encontrado");
    }

    const { data, error } = await db()
      .from("calendar_events")
      .insert({
        user_id: userId,
        professor_id: professorId,
        title: payload.title,
        kind,
        event_date: eventDate,
      })
      .select();
    if (error) throw new HttpError(500, error.message);
    if (!data || !data.length) throw new HttpError(500, "Falha ao criar o evento");
    return data[0];
  });

  router.delete("/calendario/eventos/:id", async (ctx) => {
    const userId = await currentUserId(ctx.req);
    const { data, error } = await db()
      .from("calendar_events")
      .delete()
      .eq("id", ctx.params.id)
      .eq("user_id", userId)
      .select();
    if (error) throw new HttpError(500, error.message);
    if (!data || !data.length) throw new HttpError(404, "Evento não encontrado");
    return { deleted: ctx.params.id };
  });
}
