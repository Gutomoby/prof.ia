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
  DocumentWithProfessor,
  GeneratedActivity,
  ActivitySubmitResult,
  QuestionCheckResult,
  ActivityHistoryItem,
  ActivityDetail,
  Difficulty,
  Module,
  ScoreSummary,
  StudyPlan,
  UserProgress,
  CalendarResponse,
  CalendarEvent,
  EventKind,
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

// FastAPI serializa HTTPException como {"detail": "mensagem"} — extrai isso
// em vez de jogar o JSON cru na tela. Cai pro texto bruto/statusText se a
// resposta não for esse formato (ex.: erro 502 de um proxy, HTML de erro).
async function extractErrorMessage(res: Response): Promise<string> {
  const body = await res.text();
  try {
    const parsed = JSON.parse(body);
    if (typeof parsed?.detail === "string") return parsed.detail;
  } catch {
    // não era JSON — usa o texto cru mesmo
  }
  return body || res.statusText;
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
    throw new ApiError(res.status, await extractErrorMessage(res));
  }

  // Algumas rotas (ex.: streaming) não retornam JSON — caller usa fetch direto nesses casos.
  return res.json() as Promise<T>;
}

// Helper para uploads multipart (FormData) — não força Content-Type,
// o browser define o boundary sozinho.
async function requestForm<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { method: "POST", body: formData });

  if (!res.ok) {
    throw new ApiError(res.status, await extractErrorMessage(res));
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

// Edição parcial: só os campos enviados mudam. O backend remonta o
// system_prompt sozinho, já que ele é derivado desses campos.
export function updateProfessor(
  id: string,
  payload: Partial<{
    name: string;
    discipline: string;
    teaching_style: string | null;
    exam_dates: string | null;
  }>
) {
  return request<Professor>(`/professores/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

// Apaga o professor e, em cascata, TODO o conteúdo dele: materiais, quizzes
// respondidos, planos de estudo e eventos de calendário. Não tem desfazer.
export function deleteProfessor(id: string) {
  return request<{ deleted: string }>(`/professores/${id}`, { method: "DELETE" });
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

export function generateAtividade(payload: {
  professor_id: string;
  topic?: string | null;
  module_id?: string | null;
  difficulty?: Difficulty | null;
}) {
  return request<GeneratedActivity>("/atividades/gerar", {
    method: "POST",
    body: JSON.stringify({ ...payload, activity_type: "quiz" }),
  });
}

// Corrige UMA questão, para a lição responder na hora. Não fecha a atividade:
// score, XP e sequência continuam saindo de submitAtividade, no fim.
export function conferirQuestao(payload: {
  activity_id: string;
  question_index: number;
  answer: number;
}) {
  return request<QuestionCheckResult>("/atividades/conferir", {
    method: "POST",
    body: JSON.stringify(payload),
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

export function getAtividade(activityId: string) {
  return request<ActivityDetail>(`/atividades/${activityId}`);
}

// ---------------------------------------------------------------------------
// Score / progresso (Início)
// ---------------------------------------------------------------------------

export function getScoreSummary(professorId: string) {
  return request<ScoreSummary>(`/score/${professorId}`);
}

// Plano ainda não gerado é um estado normal (não um erro) — devolve null
// em vez de propagar o 404 do backend.
export async function getStudyPlan(professorId: string): Promise<StudyPlan | null> {
  try {
    return await request<StudyPlan>(`/score/${professorId}/plano`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export function generateStudyPlan(professorId: string) {
  return request<StudyPlan>(`/score/${professorId}/plano`, { method: "POST" });
}

// ---------------------------------------------------------------------------
// Progressão global (XP, nível, sequência)
// ---------------------------------------------------------------------------

export function getProgress() {
  return request<UserProgress>("/progresso");
}

export function updateDailyGoal(daily_goal_xp: number) {
  return request<UserProgress>("/progresso/meta", {
    method: "PATCH",
    body: JSON.stringify({ daily_goal_xp }),
  });
}

// ---------------------------------------------------------------------------
// Módulos (capítulos do material, organizados por IA)
// ---------------------------------------------------------------------------

export function listModules(professorId: string) {
  return request<{ items: Module[] }>(`/professores/${professorId}/modulos`);
}

// Reorganizar substitui os módulos atuais; o histórico de quizzes permanece.
export function generateModules(professorId: string) {
  return request<{ items: Module[] }>(`/professores/${professorId}/modulos/gerar`, {
    method: "POST",
  });
}

// ---------------------------------------------------------------------------
// Calendário
// ---------------------------------------------------------------------------

// `inicio` e `fim` são datas YYYY-MM-DD, ambas inclusivas.
export function getCalendar(inicio: string, fim: string) {
  return request<CalendarResponse>(`/calendario?inicio=${inicio}&fim=${fim}`);
}

export function createEvent(payload: {
  title: string;
  kind: EventKind;
  event_date: string;
  professor_id?: string | null;
}) {
  return request<CalendarEvent>("/calendario/eventos", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deleteEvent(eventId: string) {
  return request<{ deleted: string }>(`/calendario/eventos/${eventId}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Biblioteca (acervo global)
// ---------------------------------------------------------------------------

export function listAllDocuments() {
  return request<{ items: DocumentWithProfessor[] }>("/documentos");
}

export const api = {
  request,
  listProfessors,
  getProfessor,
  createProfessor,
  updateProfessor,
  deleteProfessor,
  listDocuments,
  uploadPdf,
  uploadText,
  deleteDocument,
  generateAtividade,
  conferirQuestao,
  submitAtividade,
  listAtividades,
  getAtividade,
  getScoreSummary,
  getStudyPlan,
  generateStudyPlan,
  getProgress,
  updateDailyGoal,
  listModules,
  generateModules,
  getCalendar,
  createEvent,
  deleteEvent,
  listAllDocuments,
};
