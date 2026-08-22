/*
  Extração de texto de PDF. Porta de services/pdf.py.

  PyMuPDF é nativo (C), não roda no Edge Runtime — usa `unpdf`, um wrapper
  WASM do pdf.js feito para runtimes edge (Deno/Cloudflare Workers/Vercel
  Edge). Mesma limitação do original: PDF escaneado/imagem não tem texto pra
  extrair (sem OCR) e volta string vazia.
*/

import { extractText, getDocumentProxy } from "npm:unpdf@0";

/** Extrai o texto de um PDF, página por página, juntando as não-vazias. */
export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: false });
  const paginas = Array.isArray(text) ? text : [text];
  return paginas.filter((p) => p.trim()).join("\n\n");
}
