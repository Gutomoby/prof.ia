/*
  Rota de Documentos — porta de routers/documentos.py.

  POST   /documentos/pdf     upload de um arquivo PDF (multipart)
  POST   /documentos/texto   envia texto digitado
  GET    /documentos         lista documentos de um professor (?professor_id=...)
  DELETE /documentos/:id     remove documento (cascata em chunks)

  Cada upload dispara: extração de texto -> chunking -> embeddings -> insert
  em chunks. Se a indexação falhar, o documento e o arquivo do Storage saem
  junto (ver upload_pdf) — sem isso fica material "fantasma" com zero chunks,
  que o RAG não vê e a trilha erradamente considera já coberto.
*/

import type { Router } from "../../_shared/router.ts";
import { currentUserId, getOwnedProfessor } from "../../_shared/auth.ts";
import { db } from "../../_shared/db.ts";
import { HttpError } from "../../_shared/http.ts";
import { extractPdfText } from "../../_shared/pdf.ts";
import { indexDocument } from "../../_shared/embeddings.ts";
import { creditarXp, XP_MATERIAL_INDEXADO } from "../../_shared/progresso.ts";

const STORAGE_BUCKET = "materiais";

async function ensureProfessorExists(professorId: string, userId: string): Promise<void> {
  // Confirma que o professor existe E é de quem está chamando — sem isso,
  // o id de outra pessoa permitia injetar material (e gastar embeddings) na
  // matéria dela.
  await getOwnedProfessor(professorId, userId, "id");
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

    // 1) Extração local (sem rede)
    const text = await extractPdfText(content);
    if (!text.trim()) {
      throw new HttpError(400, "Não foi possível extrair texto. O PDF pode ser escaneado/imagem.");
    }

    // 2) Upload para o Storage. Caminho organizado por professor.
    const storagePath = `${professorId}/${file.name}`;
    const { error: erroStorage } = await db()
      .storage.from(STORAGE_BUCKET)
      .upload(storagePath, content, { contentType: "application/pdf", upsert: true });
    if (erroStorage) throw new HttpError(500, `Falha no upload: ${erroStorage.message}`);

    // 3) Registro do documento
    const { data: docRows, error: erroDoc } = await db()
      .from("documents")
      .insert({
        professor_id: professorId,
        name: file.name,
        type: "pdf",
        storage_path: storagePath,
        raw_text: text,
      })
      .select();
    if (erroDoc) throw new HttpError(500, erroDoc.message);
    if (!docRows || !docRows.length) throw new HttpError(500, "Falha ao criar registro de documento");
    const documentId = docRows[0].id as string;

    // 4) Indexação RAG (chunking + embeddings + insert). Se falhar, o
    // registro do documento TEM que sair junto — senão fica um material
    // "fantasma" com zero chunks (já aconteceu em produção: livro de 600
    // páginas, 1.4M caracteres extraídos, nenhum pedaço indexado).
    let nChunks: number;
    try {
      nChunks = await indexDocument(professorId, documentId, text);
    } catch (exc) {
      await db().from("documents").delete().eq("id", documentId);
      try {
        await db().storage.from(STORAGE_BUCKET).remove([storagePath]);
      } catch {
        // Storage é best-effort na compensação também.
      }
      console.error("Falha ao indexar documento:", exc);
      throw new HttpError(500, "Não foi possível ler o arquivo até o fim. Tente enviar de novo.");
    }

    // Material rende XP, mas não conta como "estudou hoje" — só atividade
    // mantém a sequência viva, senão bastaria subir arquivo pra não quebrar.
    await creditarXp(userId, XP_MATERIAL_INDEXADO, false);

    return { document_id: documentId, name: file.name, chunks: nChunks };
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
        .select("id, name, type, created_at")
        .eq("professor_id", professorId)
        .order("created_at", { ascending: false });
      if (error) throw new HttpError(500, error.message);
      return { items: data ?? [] };
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
      .select("id, professor_id, name, type, created_at")
      .in("professor_id", [...professores.keys()])
      .order("created_at", { ascending: false });
    if (error) throw new HttpError(500, error.message);

    const items = (data ?? [])
      .filter((row) => professores.has(row.professor_id as string))
      .map((row) => {
        const p = professores.get(row.professor_id as string)!;
        return { ...row, professor_name: p.name, discipline: p.discipline };
      });
    return { items };
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
