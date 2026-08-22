/*
  Núcleo do RAG — chunking, embeddings e busca vetorial. Porta de services/rag.py.

  Pipeline de indexação: chunkText(text) → embedTexts(chunks) → INSERT chunks
  Pipeline de retrieval:  embedTexts([query]) → match_chunks (RPC pgvector) → top-k

  DIFERENÇA DELIBERADA do Python: embeddings deixam de ser locais
  (sentence-transformers, 384 dims, zero custo) e passam a usar a API do
  Gemini (gemini-embedding-001, truncado para 768 dims via
  outputDimensionality — o checkpoint recomendado mais baixo do modelo, ver
  docs/migracao-supabase.md). Motivo: Deno/Edge Functions não rodam modelos
  PyTorch locais. Reaproveita GEMINI_API_KEY, que o projeto já usa para quiz.

  Isso exige reprocessar 100% dos chunks já indexados — MiniLM e Gemini vivem
  em espaços vetoriais diferentes, mesmo em dimensão igual. Ver o script de
  backfill em docs/migracao-supabase.md.
*/

import { getEncoding } from "npm:js-tiktoken@1";
import { db } from "./db.ts";

const CHUNK_SIZE_TOKENS = 500;
const CHUNK_OVERLAP_TOKENS = 50;
const RAG_TOP_K = 5;

// Dimensão do embedding — precisa bater com chunks.embedding (vector(768)) e
// com a assinatura de match_chunks. Ver nota no topo do arquivo.
export const EMBEDDING_DIMS = 768;
const EMBEDDING_MODEL = "gemini-embedding-001";

let _encoder: ReturnType<typeof getEncoding> | null = null;
function encoder() {
  if (!_encoder) _encoder = getEncoding("cl100k_base");
  return _encoder;
}

/**
 * Fragmenta texto em pedaços de ~chunkSizeTokens com overlap entre eles.
 *
 * Ex.: chunk=500, overlap=50 → janelas que andam de 450 em 450 tokens, com
 * cada janela carregando 50 tokens do final da anterior. Isso evita que
 * conceitos cortados na fronteira percam contexto.
 */
export function chunkText(
  text: string,
  chunkSizeTokens: number = CHUNK_SIZE_TOKENS,
  overlapTokens: number = CHUNK_OVERLAP_TOKENS,
): string[] {
  if (overlapTokens >= chunkSizeTokens) {
    throw new Error("overlapTokens precisa ser menor que chunkSizeTokens");
  }

  const enc = encoder();
  const tokens = enc.encode(text);
  if (!tokens.length) return [];

  const step = chunkSizeTokens - overlapTokens;
  const chunks: string[] = [];
  for (let start = 0; start < tokens.length; start += step) {
    const window = tokens.slice(start, start + chunkSizeTokens);
    if (!window.length) break;
    chunks.push(enc.decode(window));
    if (start + chunkSizeTokens >= tokens.length) break;
  }
  return chunks;
}

/**
 * Gera embeddings via API do Gemini, em batch (batchEmbedContents).
 *
 * Retorna lista de vetores de EMBEDDING_DIMS floats, prontos para o pgvector.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (!texts.length) return [];

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY não configurada no ambiente");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:batchEmbedContents?key=${apiKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        requests: texts.map((t) => ({
          model: `models/${EMBEDDING_MODEL}`,
          content: { parts: [{ text: t }] },
          outputDimensionality: EMBEDDING_DIMS,
        })),
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini embeddings API ${res.status}: ${await res.text()}`);

  const data = await res.json();
  // deno-lint-ignore no-explicit-any
  return (data.embeddings ?? []).map((e: any) => e.values as number[]);
}

// Chunks por lote de embedding/insert. Um livro rende mais de mil pedaços; em
// lote único o INSERT vira uma requisição de vários MB. Mesmo tamanho de lote
// do Python (services/rag.py) — mantém a memória/tempo de resposta previsíveis.
const _LOTE = 64;

/**
 * Chunkifica + embeda + insere chunks no banco, em lotes.
 * Retorna o número de chunks indexados.
 */
export async function indexDocument(professorId: string, documentId: string, text: string): Promise<number> {
  const chunks = chunkText(text);
  if (!chunks.length) return 0;

  let indexados = 0;
  for (let inicio = 0; inicio < chunks.length; inicio += _LOTE) {
    const lote = chunks.slice(inicio, inicio + _LOTE);
    const vetores = await embedTexts(lote);

    const { error } = await db()
      .from("chunks")
      .insert(
        lote.map((conteudo, i) => ({
          professor_id: professorId,
          document_id: documentId,
          content: conteudo,
          embedding: vetores[i],
          chunk_index: inicio + i,
        })),
      );
    if (error) throw new Error(error.message);
    indexados += lote.length;
  }
  return indexados;
}

export type ChunkResult = { id: string; document_id: string; content: string; similarity: number };

/**
 * Recupera os top-k chunks mais similares à query, dentro de um professor.
 *
 * Embeda a query e chama a função SQL match_chunks (RPC), que usa o operador
 * `<=>` do pgvector (cosine distance) — mesma função da migration original,
 * só a dimensão do parâmetro mudou (ver docs/migracao-supabase.md).
 */
export async function searchChunks(
  professorId: string,
  query: string,
  topK: number = RAG_TOP_K,
): Promise<ChunkResult[]> {
  const [queryEmb] = await embedTexts([query]);
  if (!queryEmb) return [];

  const { data, error } = await db().rpc("match_chunks", {
    query_embedding: queryEmb,
    match_professor_id: professorId,
    match_count: topK,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as ChunkResult[];
}
