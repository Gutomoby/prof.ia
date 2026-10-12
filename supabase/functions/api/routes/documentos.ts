/*
  Rota de Documentos — porta de routers/documentos.py.

  POST   /documentos/pdf     upload de um arquivo PDF (multipart)
  POST   /documentos/texto   envia texto digitado
  GET    /documentos         lista documentos de um professor (?professor_id=...)
  DELETE /documentos/:id     remove documento (cascata em chunks)

  POST   /documentos/:id/retomar  retoma a leitura de um PDF que parou

  PDF é lido EM SEGUNDO PLANO (Cloud Run): o upload devolve na hora com
  status 'processando' e a tela acompanha por GET /documentos (status,
  chunks_done/chunks_total, erro). Se a leitura falha, o documento FICA com o
  progresso e o motivo — "retomar" continua de onde parou, sem pagar de novo
  os embeddings já gerados. (Antes, qualquer falha apagava tudo.)
*/

import type { Router } from "../../_shared/router.ts";
import { currentUserId, getOwnedProfessor } from "../../_shared/auth.ts";
import { db } from "../../_shared/db.ts";
import { HttpError } from "../../_shared/http.ts";
import { indexDocument } from "../../_shared/embeddings.ts";
import { creditarXp, XP_MATERIAL_INDEXADO } from "../../_shared/progresso.ts";

const STORAGE_BUCKET = "materiais";

async function ensureProfessorExists(professorId: string, userId: string): Promise<void> {
  // Confirma que o professor existe E é de quem está chamando — sem isso,
  // o id de outra pessoa permitia injetar material (e gastar embeddings) na
  // matéria dela.
  await getOwnedProfessor(professorId, userId, "id");
}

// Nome de arquivo com acento ("Avaliação", "Provisões") quebra a key do
// Storage com "Invalid key" — mesmo bug já existia no Python original
// (routers/documentos.py usava file.filename direto), só nunca tinha sido
// exercitado com nome acentuado até agora. O nome exibido ao aluno
// (documents.name) continua o original; só a key vira ASCII.
function sanitizeStorageKey(nome: string): string {
  const semAcento = nome.normalize("NFD").replace(/[̀-ͯ]/g, "");
  return semAcento.replace(/[^a-zA-Z0-9._-]/g, "_");
}

// Extração + chunking + embeddings + insert de PDF rodam no Cloud Run, não
// aqui: Edge Functions têm teto de 2s de CPU por requisição (ver
// docs/migracao-supabase.md), insuficiente para PDFs grandes — já quebrou em
// produção com um livro de 600 páginas / 1374 chunks. O Cloud Run baixa o
// arquivo direto do Storage (service_role), então o payload aqui é só os ids.
//
// Aqui só se AVISA o Cloud Run: ele reivindica o documento (claim atômico) e
// responde 202 na hora, seguindo em segundo plano. Nunca lança: se o aviso
// falhar, o documento fica 'processando' sem batimento e o próximo GET
// /documentos (ou "retomar") avisa de novo.
async function iniciarLeituraNoCloudRun(args: {
  documentId: string;
  professorId: string;
  storagePath: string;
}): Promise<void> {
  const url = Deno.env.get("PDF_PROCESSOR_URL");
  const secret = Deno.env.get("PDF_PROCESSOR_SECRET");
  if (!url || !secret) {
    console.error("PDF_PROCESSOR_URL/PDF_PROCESSOR_SECRET não configurados no ambiente");
    return;
  }
  try {
    const res = await fetch(`${url}/processar`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": secret },
      body: JSON.stringify({
        document_id: args.documentId,
        professor_id: args.professorId,
        storage_path: args.storagePath,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) console.error(`Cloud Run /processar ${res.status}: ${(await res.text()).slice(0, 300)}`);
  } catch (exc) {
    console.error("Falha ao avisar o Cloud Run:", exc instanceof Error ? exc.name : "erro");
  }
}

// Sem batimento há tanto tempo = o worker morreu (instância reciclada). Mesmo
// limite do claim_documento no banco.
const BATIMENTO_VENCIDO_MS = 120_000;
// Documento recém-criado ainda sem batimento: dá um tempo ao primeiro aviso.
const SEM_BATIMENTO_MS = 60_000;

function leituraParada(doc: { status: unknown; heartbeat_at: unknown; created_at: unknown }): boolean {
  if (doc.status !== "processando") return false;
  const agora = Date.now();
  if (doc.heartbeat_at) return agora - new Date(doc.heartbeat_at as string).getTime() > BATIMENTO_VENCIDO_MS;
  return agora - new Date(doc.created_at as string).getTime() > SEM_BATIMENTO_MS;
}

const COLUNAS_LISTA =
  "id, professor_id, name, type, created_at, status, chunks_total, chunks_done, erro, heartbeat_at, storage_path, xp_creditado";

type LinhaDoc = Record<string, unknown>;

/**
 * Efeitos colaterais de quem olha a lista: religa leitura parada e credita o
 * XP de material que ficou pronto (uma vez só, pelo flag xp_creditado).
 */
async function acompanharDocumentos(rows: LinhaDoc[], userId: string): Promise<void> {
  const paradas = rows.filter(leituraParada);
  await Promise.allSettled(
    paradas.map((d) =>
      iniciarLeituraNoCloudRun({
        documentId: d.id as string,
        professorId: d.professor_id as string,
        storagePath: d.storage_path as string,
      })
    ),
  );

  for (const d of rows) {
    if (d.status !== "pronto" || d.xp_creditado !== false) continue;
    // O UPDATE condicional é o "claim" do XP: duas listas simultâneas não
    // creditam em dobro, só quem de fato virou o flag recebe.
    const { data } = await db()
      .from("documents")
      .update({ xp_creditado: true })
      .eq("id", d.id as string)
      .eq("xp_creditado", false)
      .select("id");
    if (data && data.length) {
      await creditarXp(userId, XP_MATERIAL_INDEXADO, false);
      d.xp_creditado = true;
    }
  }
}

/** O que o navegador precisa ver — sem caminho de Storage nem batimento. */
function paraCliente(d: LinhaDoc): LinhaDoc {
  // deno-lint-ignore no-unused-vars
  const { storage_path, heartbeat_at, xp_creditado, ...resto } = d;
  return resto;
}

export function register(router: Router): void {
  router.post("/documentos/pdf", async (ctx) => {
    const userId = await currentUserId(ctx.req);

    // Multipart, não JSON — não passa por ctx.body().
    const form = await ctx.req.formData();
    const professorId = form.get("professor_id");
    const file = form.get("file");

    if (typeof professorId !== "string" || !professorId) {
      throw new HttpError(400, "Campo \"professor_id\" é obrigatório.");
    }
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".pdf")) {
      throw new HttpError(400, "O arquivo precisa ser um PDF (.pdf)");
    }

    await ensureProfessorExists(professorId, userId);

    const content = new Uint8Array(await file.arrayBuffer());
    if (!content.length) throw new HttpError(400, "Arquivo vazio");

    // 1) Upload para o Storage. Caminho organizado por professor.
    const storagePath = `${professorId}/${sanitizeStorageKey(file.name)}`;
    const { error: erroStorage } = await db()
      .storage.from(STORAGE_BUCKET)
      .upload(storagePath, content, { contentType: "application/pdf", upsert: true });
    if (erroStorage) throw new HttpError(500, `Falha no upload: ${erroStorage.message}`);

    // 2) Registro do documento. raw_text fica vazio até o Cloud Run extrair
    // — evita reenviar os bytes do PDF de novo por HTTP. Nasce 'processando';
    // o XP só é creditado quando ficar 'pronto' (xp_creditado=false).
    const { data: docRows, error: erroDoc } = await db()
      .from("documents")
      .insert({
        professor_id: professorId,
        name: file.name,
        type: "pdf",
        storage_path: storagePath,
        status: "processando",
        xp_creditado: false,
      })
      .select();
    if (erroDoc) throw new HttpError(500, erroDoc.message);
    if (!docRows || !docRows.length) throw new HttpError(500, "Falha ao criar registro de documento");
    const documentId = docRows[0].id as string;

    // 3) Avisa o Cloud Run e devolve na hora. A leitura segue em segundo plano
    // e o aluno pode sair da tela; o andamento vem de GET /documentos.
    await iniciarLeituraNoCloudRun({ documentId, professorId, storagePath });

    return { document_id: documentId, name: file.name, status: "processando" };
  });

  router.post("/documentos/texto", async (ctx) => {
    const userId = await currentUserId(ctx.req);
    const payload = await ctx.body<{ professor_id?: unknown; name?: unknown; raw_text?: unknown }>();

    const professorId = payload.professor_id as string;
    if (typeof professorId !== "string" || !professorId) {
      throw new HttpError(400, "Campo \"professor_id\" é obrigatório.");
    }
    await ensureProfessorExists(professorId, userId);

    const rawText = (payload.raw_text as string) ?? "";
    if (!rawText.trim()) throw new HttpError(400, "Texto não pode ser vazio");
    const name = (payload.name as string) ?? "";

    const { data: docRows, error: erroDoc } = await db()
      .from("documents")
      .insert({ professor_id: professorId, name, type: "text", raw_text: rawText })
      .select();
    if (erroDoc) throw new HttpError(500, erroDoc.message);
    if (!docRows || !docRows.length) throw new HttpError(500, "Falha ao criar documento");
    const documentId = docRows[0].id as string;

    const nChunks = await indexDocument(professorId, documentId, rawText);
    await creditarXp(userId, XP_MATERIAL_INDEXADO, false);

    return { document_id: documentId, name, chunks: nChunks };
  });

  router.get("/documentos", async (ctx) => {
    const userId = await currentUserId(ctx.req);
    const professorId = ctx.query.get("professor_id");

    if (professorId) {
      await getOwnedProfessor(professorId, userId, "id");
      const { data, error } = await db()
        .from("documents")
        .select(COLUNAS_LISTA)
        .eq("professor_id", professorId)
        .order("created_at", { ascending: false });
      if (error) throw new HttpError(500, error.message);
      const rows = (data ?? []) as LinhaDoc[];
      await acompanharDocumentos(rows, userId);
      return { items: rows.map(paraCliente) };
    }

    // Sem professor_id: documentos de TODAS as matérias (a Biblioteca).
    const { data: professorRows, error: erroProf } = await db()
      .from("professors")
      .select("id, name, discipline")
      .eq("user_id", userId);
    if (erroProf) throw new HttpError(500, erroProf.message);
    const professores = new Map((professorRows ?? []).map((p) => [p.id as string, p]));
    if (!professores.size) return { items: [] };

    const { data, error } = await db()
      .from("documents")
      .select(COLUNAS_LISTA)
      .in("professor_id", [...professores.keys()])
      .order("created_at", { ascending: false });
    if (error) throw new HttpError(500, error.message);

    const rows = ((data ?? []) as LinhaDoc[]).filter((row) => professores.has(row.professor_id as string));
    await acompanharDocumentos(rows, userId);
    const items = rows.map((row) => {
      const p = professores.get(row.professor_id as string)!;
      return { ...paraCliente(row), professor_name: p.name, discipline: p.discipline };
    });
    return { items };
  });

  router.post("/documentos/:id/retomar", async (ctx) => {
    const userId = await currentUserId(ctx.req);

    const { data, error } = await db()
      .from("documents")
      .select("id, professor_id, storage_path, status, type")
      .eq("id", ctx.params.id)
      .limit(1);
    if (error) throw new HttpError(500, error.message);
    if (!data || !data.length) throw new HttpError(404, "Documento não encontrado");
    const doc = data[0];

    // O id vem do cliente: confere que o documento é de quem pediu.
    await getOwnedProfessor(doc.professor_id as string, userId, "id");

    if (doc.type !== "pdf" || !doc.storage_path) {
      throw new HttpError(400, "Só PDFs podem ser retomados.");
    }
    if (doc.status === "pronto") return { document_id: doc.id, status: "pronto" };

    // O claim atômico no Cloud Run decide se de fato retoma (erro, ou
    // processando sem batimento). Se já tem worker vivo, não faz nada.
    await iniciarLeituraNoCloudRun({
      documentId: doc.id as string,
      professorId: doc.professor_id as string,
      storagePath: doc.storage_path as string,
    });

    return { document_id: doc.id, status: "processando" };
  });

  router.delete("/documentos/:id", async (ctx) => {
    const userId = await currentUserId(ctx.req);

    // Busca antes, pra saber se há arquivo no Storage pra limpar.
    const { data, error } = await db()
      .from("documents")
      .select("storage_path, professor_id")
      .eq("id", ctx.params.id)
      .limit(1);
    if (error) throw new HttpError(500, error.message);
    if (!data || !data.length) throw new HttpError(404, "Documento não encontrado");

    // O id do documento vem do cliente: sem esta checagem, conhecer um id
    // bastava para apagar o material de outra pessoa.
    await getOwnedProfessor(data[0].professor_id as string, userId, "id");

    const storagePath = data[0].storage_path as string | null;
    if (storagePath) {
      try {
        await db().storage.from(STORAGE_BUCKET).remove([storagePath]);
      } catch {
        // Storage opcional: não interrompe a exclusão do registro.
      }
    }

    const { error: erroDelete } = await db().from("documents").delete().eq("id", ctx.params.id);
    if (erroDelete) throw new HttpError(500, erroDelete.message);
    return { deleted: ctx.params.id };
  });
}
