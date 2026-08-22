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
import { db, selectAll } from "../../_shared/db.ts";
import { HttpError } from "../../_shared/http.ts";
import { NOTACAO_MATEMATICA, generateModules } from "../../_shared/claude.ts";
import { normalizarProfundo } from "../../_shared/notacao.ts";

// Orçamento de texto enviado ao Claude na organização. Amostragem uniforme
// por documento quando o material completo passa disso — ver _materialDigest.
// 240 mil caracteres são ~60 mil tokens, folgado nos 200 mil de contexto do
// Sonnet (ver nota histórica em modulos.py sobre o teto anterior de 60 mil).
const _MAX_DIGEST_CHARS = 240_000;

// Piso de chunks por documento na amostragem — um material pequeno ao lado de
// um livro receberia fração de chunk pela regra proporcional e sumiria.
const _MIN_CHUNKS_POR_DOC = 6;

type ChunkRow = { document_id: string; chunk_index: number; content: string };

/** Todos os chunks do professor, paginando de verdade (teto de 1000 do PostgREST). */
async function chunksDoProfessor(professorId: string): Promise<ChunkRow[]> {
  return await selectAll<ChunkRow>((de, ate) =>
    db()
      .from("chunks")
      .select("document_id, chunk_index, content")
      .eq("professor_id", professorId)
      .order("document_id")
      .order("chunk_index")
      .range(de, ate),
  );
}

/**
 * Concatena o material do professor num texto só, com cabeçalho por documento.
 *
 * A amostragem é POR DOCUMENTO, não global — cada documento ganha uma fatia
 * proporcional ao seu tamanho, com um piso, senão um documento pequeno pode
 * não ser sorteado nenhuma vez numa amostragem global.
 */
async function materialDigest(professorId: string): Promise<string | null> {
  const { data: docs, error } = await db()
    .from("documents")
    .select("id, name")
    .eq("professor_id", professorId);
  if (error) throw new HttpError(500, error.message);
  if (!docs || !docs.length) return null;
  const docNames = new Map(docs.map((d) => [d.id as string, d.name as string]));

  const rows = await chunksDoProfessor(professorId);
  if (!rows.length) return null;

  const porDoc = new Map<string, ChunkRow[]>();
  for (const r of rows) {
    const lista = porDoc.get(r.document_id) ?? [];
    lista.push(r);
    porDoc.set(r.document_id, lista);
  }

  const totalChars = rows.reduce((s, r) => s + r.content.length, 0);
  const parts: string[] = [];

  for (const [docId, chunksOriginais] of porDoc) {
    let chunks = chunksOriginais;
    if (totalChars > _MAX_DIGEST_CHARS) {
      const cota = Math.max(
        _MIN_CHUNKS_POR_DOC,
        Math.round(chunks.length * (_MAX_DIGEST_CHARS / totalChars)),
      );
      if (cota < chunks.length) {
        // Passo uniforme: pega do começo, do meio e do fim do documento, em
        // vez dos primeiros N — o índice e o sumário não dizem o que o
        // capítulo 12 cobre.
        const passo = chunks.length / cota;
        chunks = Array.from({ length: cota }, (_, i) =>
          chunks[Math.min(chunks.length - 1, Math.round(i * passo))]
        );
      }
    }

    parts.push(`\n\n===== DOCUMENTO: ${docNames.get(docId) ?? "sem nome"} =====\n`);
    parts.push(...chunks.map((c) => c.content));
  }

  return parts.join("\n");
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
    const professor = await getOwnedProfessor(professorId, userId, "id, name, discipline");

    const digest = await materialDigest(professorId);
    if (!digest) {
      throw new HttpError(
        400,
        "Nenhum material enviado ainda — suba PDFs ou textos antes de gerar os módulos.",
      );
    }

    // A trilha CRESCE: módulos existentes ficam de pé (o histórico de quiz
    // aponta pra eles) e a IA só acrescenta o que ainda não está coberto. Sem
    // dizer isso no prompt, o modelo relê o material inteiro e devolve um
    // currículo completo de novo — duplicando a trilha (já aconteceu em
    // produção: "5 de 7" virou "5 de 14" sem o aluno errar nada).
    const { data: existingRows, error: erroExistentes } = await db()
      .from("modules")
      .select("position, name, topics")
      .eq("professor_id", professorId)
      .order("position");
    if (erroExistentes) throw new HttpError(500, erroExistentes.message);
    const existentes = existingRows ?? [];

    const systemPrompt =
      `Você é um planejador pedagógico da disciplina ${professor.discipline}. ` +
      "Sua tarefa é organizar o material de estudo do aluno em módulos, como os " +
      "capítulos de um livro didático: em ordem pedagógica (do fundamento ao " +
      "avançado), sem sobreposição entre módulos, cobrindo todo o material.";

    let instrucao: string;
    if (existentes.length) {
      const jaCobertos = existentes
        .map((m) => `- ${m.name}: ${((m.topics as string[]) ?? []).join(", ") || "(sem tópicos)"}`)
        .join("\n");
      instrucao =
        "O aluno JÁ TEM uma trilha montada, listada abaixo em MÓDULOS " +
        "EXISTENTES. Ela não pode ser refeita nem repetida.\n\n" +
        "Compare o MATERIAL com os MÓDULOS EXISTENTES e devolva APENAS " +
        "módulos NOVOS, cobrindo assuntos do material que nenhum módulo " +
        "existente já cobre. Um assunto conta como coberto mesmo que o " +
        "título esteja escrito de outro jeito — compare o conteúdo, não a " +
        "redação.\n" +
        "Se todo o material já estiver coberto, devolva uma lista vazia. " +
        "É um resultado válido e esperado: significa que a trilha já dá " +
        "conta do material.\n\n" +
        `MÓDULOS EXISTENTES:\n${jaCobertos}\n`;
    } else {
      instrucao = "Organize o material abaixo em 3 a 8 módulos.\n";
    }

    const userPrompt =
      `${instrucao}\n` +
      "Para cada módulo devolvido dê um título curto (como capítulo de " +
      "livro), uma descrição de 1-2 frases e a lista de tópicos cobertos — " +
      "cada tópico específico o suficiente para virar questão de quiz. " +
      `${NOTACAO_MATEMATICA} ` +
      "Use a tool return_modules para responder.\n\n" +
      `MATERIAL:\n${digest}`;

    const result = await generateModules(systemPrompt, userPrompt);
    // Nome e tópicos do capítulo aparecem na trilha e no título do quiz — a
    // notação solta era visível ali antes de qualquer questão ser gerada.
    // deno-lint-ignore no-explicit-any
    const modules = normalizarProfundo(result.modules ?? []) as any[];

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
