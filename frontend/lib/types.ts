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

// ---------------------------------------------------------------------------
// Score / progresso (Início)
// ---------------------------------------------------------------------------

export interface TopicStat {
  topico: string;
  n_questions: number;
  accuracy_pct: number;
  status: "dominado" | "pendente";
}

export interface ScoreTrendPoint {
  data: string;
  score_pct: number;
}

export interface WeeklyGoal {
  quizzes_respondidos: number;
  media_score_pct: number | null;
}

export interface MonthlyGoal {
  topicos_dominados: number;
  topicos_totais: number;
}

export interface ScoreSummary {
  streak_days: number;
  topics: TopicStat[];
  score_trend: ScoreTrendPoint[];
  weekly: WeeklyGoal;
  monthly: MonthlyGoal;
  overall_mastery_pct: number;
  exam_dates: string | null;
}

export interface StudyPlanContent {
  resumo: string;
  prioridades: string[];
  semana: string[];
  mes: string[];
}

export interface StudyPlan {
  id: string;
  professor_id: string;
  content: StudyPlanContent;
  created_at: string;
}
