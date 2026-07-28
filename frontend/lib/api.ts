/*
  Wrapper fino para chamar o backend FastAPI.

  Cada função aqui corresponde a um endpoint do backend. O objetivo é
  centralizar a URL base (NEXT_PUBLIC_API_URL) e o tratamento de erro,
  para que as telas só importem funções tipadas e nunca lidem com fetch direto.
*/

import type {
  Professor,
  ProfessorListItem,
  DocumentItem,
  GeneratedActivity,
  ActivitySubmitResult,
  ActivityHistoryItem,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// Erro lançado quando a API responde com status != 2xx.
// Carrega o status e a mensagem do backend para exibir na UI.
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

// Helper interno — todos os métodos abaixo passam por aqui.
// Adiciona JSON headers e converte respostas em erro num ApiError com mensagem.
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new ApiError(res.status, body || res.statusText);
  }

  // Algumas rotas (ex.: streaming) não retornam JSON — caller usa fetch direto nesses casos.
  return res.json() as Promise<T>;
}

// Helper para uploads multipart (FormData) — não força Content-Type,
// o browser define o boundary sozinho.
async function requestForm<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { method: "POST", body: formData });

  if (!res.ok) {
    const body = await res.text();
    throw new ApiError(res.status, body || res.statusText);
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Professores
// ---------------------------------------------------------------------------

export function listProfessors() {
  return request<{ items: ProfessorListItem[] }>("/professores");
}

export function getProfessor(id: string) {
  return request<Professor>(`/professores/${id}`);
}

export function createProfessor(payload: {
  name: string;
  discipline: string;
  teaching_style?: string | null;
  exam_dates?: string | null;
}) {
  return request<Professor>("/professores", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ---------------------------------------------------------------------------
// Documentos
// ---------------------------------------------------------------------------

export function listDocuments(professorId: string) {
  return request<{ items: DocumentItem[] }>(`/documentos?professor_id=${professorId}`);
}

export function uploadPdf(professorId: string, file: File) {
  const formData = new FormData();
  formData.append("professor_id", professorId);
  formData.append("file", file);
  return requestForm<{ document_id: string; name: string; chunks: number }>(
    "/documentos/pdf",
    formData
  );
}

export function uploadText(payload: { professor_id: string; name: string; raw_text: string }) {
  return request<{ document_id: string; name: string; chunks: number }>("/documentos/texto", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deleteDocument(id: string) {
  return request<{ deleted: string }>(`/documentos/${id}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Atividades (quiz)
// ---------------------------------------------------------------------------

export function generateAtividade(payload: { professor_id: string; topic?: string | null }) {
  return request<GeneratedActivity>("/atividades/gerar", {
    method: "POST",
    body: JSON.stringify({ ...payload, activity_type: "quiz" }),
  });
}

export function submitAtividade(payload: {
  activity_id: string;
  answers: Record<string, number>;
  time_seconds: number;
}) {
  return request<ActivitySubmitResult>("/atividades/submeter", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function listAtividades(professorId: string, activityType = "quiz") {
  return request<{ items: ActivityHistoryItem[] }>(
    `/atividades?professor_id=${professorId}&activity_type=${activityType}`
  );
}

export const api = {
  request,
  listProfessors,
  getProfessor,
  createProfessor,
  listDocuments,
  uploadPdf,
  uploadText,
  deleteDocument,
  generateAtividade,
  submitAtividade,
  listAtividades,
};
