/*
  Rota de Módulos — porta de routers/modulos.py.

  GET  /professores/:id/modulos          lista com stats de tentativa
  POST /professores/:id/modulos/gerar    (re)organiza o material em módulos

  A IA lê o material e devolve capítulos em ordem pedagógica. A trilha CRESCE:
  módulos existentes ficam de pé, a IA só acrescenta o que ainda não está
  coberto — ver o prompt em gerarModulos().
*/

import type { Router } from "../../_shared/router.ts";
import { currentUserId, getOwnedProfessor } from "../../_shared/auth.ts";
import { db } from "../../_shared/db.ts";
import { HttpError } from "../../_shared/http.ts";
import { normalizarProfundo } from "../../_shared/notacao.ts";

// Montar o digest do material (que pode passar de 600k caracteres, ver
// docs/migracao-supabase.md) e chamar o Claude com ele rodam no Cloud Run,
// não aqui — mesmo motivo do PDF em documentos.ts: Edge Functions têm teto de
// 2s de CPU / tempo de parede por requisição, e essa chamada já quebrou em
// produção (POST .../modulos/gerar devolvendo 500 genérico depois de ~36s).
async function gerarModulosNoCloudRun(professorId: string): Promise<unknown[]> {
  const url = Deno.env.get("PDF_PROCESSOR_URL");
  const secret = Deno.env.get("PDF_PROCESSOR_SECRET");
  if (!url || !secret) throw new Error("PDF_PROCESSOR_URL/PDF_PROCESSOR_SECRET não configurados no ambiente");

  const res = await fetch(`${url}/gerar-modulos`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": secret },
    body: JSON.stringify({ professor_id: professorId }),
  });

  const data = await res.json().catch(() => ({}));
  if (res.status === 422 && data.error === "sem_material") {
    throw new HttpError(
      400,
      "Nenhum material enviado ainda — suba PDFs ou textos antes de gerar os módulos.",
    );
  }
  if (!res.ok) throw new Error(`Cloud Run /gerar-modulos ${res.status}: ${JSON.stringify(data)}`);
  return (data.modules ?? []) as unknown[];
}

type ModuleStats = { n_tentativas: number; melhor_score_pct: number | null };

/** Tentativas e melhor score por módulo, a partir do histórico de quizzes. */
async function moduleStats(professorId: string): Promise<Map<string, ModuleStats>> {
  const { data, error } = await db()
    .from("activity_results")
    .select("module_id, score_pct")
    .eq("professor_id", professorId)
    .not("module_id", "is", null)
    .not("score_pct", "is", null);
  if (error) throw new HttpError(500, error.message);

  const stats = new Map<string, ModuleStats>();
  for (const row of data ?? []) {
    const mid = row.module_id as string;
    const s = stats.get(mid) ?? { n_tentativas: 0, melhor_score_pct: null };
    s.n_tentativas += 1;
    const score = row.score_pct as number;
    if (s.melhor_score_pct === null || score > s.melhor_score_pct) s.melhor_score_pct = score;
    stats.set(mid, s);
  }
  return stats;
}

// deno-lint-ignore no-explicit-any
function comStats(rows: any[], stats: Map<string, ModuleStats>) {
  return rows.map((row) => ({
    ...row,
    ...(stats.get(row.id) ?? { n_tentativas: 0, melhor_score_pct: null }),
  }));
}

async function listarModulos(professorId: string, userId: string) {
  await getOwnedProfessor(professorId, userId, "id");
  const { data, error } = await db()
    .from("modules")
    .select("*")
    .eq("professor_id", professorId)
    .order("position");
  if (error) throw new HttpError(500, error.message);
  const rows = data ?? [];
  return { items: comStats(rows, rows.length ? await moduleStats(professorId) : new Map()) };
}

export function register(router: Router): void {
  router.get("/professores/:id/modulos", async (ctx) => {
    const userId = await currentUserId(ctx.req);
    return await listarModulos(ctx.params.id, userId);
  });

  router.post("/professores/:id/modulos/gerar", async (ctx) => {
    const userId = await currentUserId(ctx.req);
    const professorId = ctx.params.id;
    await getOwnedProfessor(professorId, userId, "id");

    // A trilha CRESCE: módulos existentes ficam de pé (o histórico de quiz
    // aponta pra eles) e a IA só acrescenta o que ainda não está coberto —
    // por isso a lista atual é buscada aqui de novo, mesmo o Cloud Run já
    // tendo consultado a mesma coisa pra montar o prompt (consulta barata,
    // não vale a pena economizar às custas de acoplar os dois lados).
    const { data: existingRows, error: erroExistentes } = await db()
      .from("modules")
      .select("position, name, topics")
      .eq("professor_id", professorId)
      .order("position");
    if (erroExistentes) throw new HttpError(500, erroExistentes.message);
    const existentes = existingRows ?? [];

    const result = await gerarModulosNoCloudRun(professorId);
    // Nome e tópicos do capítulo aparecem na trilha e no título do quiz — a
    // notação solta era visível ali antes de qualquer questão ser gerada.
    // deno-lint-ignore no-explicit-any
    const modules = normalizarProfundo(result ?? []) as any[];

    if (!modules.length) {
      // Nenhum módulo novo é sucesso, não erro: o material já está todo
      // coberto. Devolver a trilha atual deixa a tela consistente.
      if (existentes.length) return await listarModulos(professorId, userId);
      throw new HttpError(502, "A IA não retornou nenhum módulo.");
    }

    // Rede de segurança para o caso de o modelo repetir mesmo assim: descarta
    // nome que já existe (ignorando caixa e espaços).
    const nomesExistentes = new Set(
      existentes.map((m) => ((m.name as string) ?? "").trim().toLowerCase()),
    );
    const novos = modules.filter((m) => !nomesExistentes.has(((m.name as string) ?? "").trim().toLowerCase()));
    if (!novos.length) return await listarModulos(professorId, userId);

    const maxPosition = (existentes.length ? (existentes[existentes.length - 1].position as number) : -1) + 1;

    const { data: inserted, error: erroInsert } = await db()
      .from("modules")
      .insert(
        novos.map((m, i) => ({
          professor_id: professorId,
          position: maxPosition + i,
          name: m.name,
          description: m.description ?? null,
          topics: m.topics ?? [],
        })),
      )
      .select();
    if (erroInsert) throw new HttpError(500, erroInsert.message);
    if (!inserted || !inserted.length) throw new HttpError(500, "Falha ao salvar os módulos gerados.");

    // Devolve a trilha INTEIRA (antiga + nova) — a tela que chamou está
    // desenhando a trilha completa.
    return await listarModulos(professorId, userId);
  });
}
