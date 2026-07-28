// Tipos espelhando os schemas Pydantic de backend/models.py.

export interface Professor {
  id: string;
  user_id: string;
  name: string;
  discipline: string;
  teaching_style: string | null;
  exam_dates: string | null;
  system_prompt: string | null;
  created_at: string;
}

export interface ProfessorListItem {
  id: string;
  name: string;
  discipline: string;
  teaching_style: string | null;
  created_at: string;
}

export interface DocumentItem {
  id: string;
  name: string;
  type: "pdf" | "text";
  created_at: string;
}

export interface QuizQuestion {
  topico: string;
  enunciado: string;
  alternativas: string[];
  // Presentes só depois da correção (POST /submeter) — nunca antes.
  resposta_correta?: number;
  explicacao?: string;
}

export interface GeneratedActivity {
  activity_id: string;
  topic: string | null;
  questions: QuizQuestion[];
}

export interface SubmittedQuestionResult extends QuizQuestion {
  resposta_correta: number;
  explicacao: string;
  resposta_usuario: number | null;
  correta: boolean;
}

export interface ActivitySubmitResult {
  score_pct: number;
  questions: SubmittedQuestionResult[];
}

export interface ActivityHistoryItem {
  id: string;
  topic: string | null;
  score_pct: number | null;
  time_seconds: number | null;
  created_at: string;
}

export interface ActivityDetail {
  id: string;
  topic: string | null;
  score_pct: number;
  time_seconds: number | null;
  created_at: string;
  questions: SubmittedQuestionResult[];
}
