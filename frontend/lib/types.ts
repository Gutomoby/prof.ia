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

export type Difficulty = "facil" | "medio" | "dificil";

// Rótulo de cada dificuldade. Vive junto do tipo porque é vocabulário do
// domínio, usado no seletor da tela 22 e no histórico de tentativas — antes
// morava no DifficultyPicker, que saiu quando o seletor virou Segmented.
export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  facil: "Fácil",
  medio: "Médio",
  dificil: "Difícil",
};

export interface GeneratedActivity {
  activity_id: string;
  topic: string | null;
  module_id: string | null;
  difficulty: Difficulty | null;
  questions: QuizQuestion[];
}

export interface SubmittedQuestionResult extends QuizQuestion {
  resposta_correta: number;
  explicacao: string;
  resposta_usuario: number | null;
  correta: boolean;
}

// Resposta de POST /atividades/conferir — o gabarito de UMA questão, pedido
// depois que o aluno respondeu. É o que permite a lição corrigir na hora sem
// que o quiz inteiro viaje com as respostas.
export interface QuestionCheckResult {
  correta: boolean;
  resposta_correta: number;
  explicacao: string;
}

export interface ActivitySubmitResult {
  score_pct: number;
  questions: SubmittedQuestionResult[];
  xp_ganho: number;
  // Tópicos que cruzaram o limiar de domínio com ESTA tentativa.
  topicos_dominados: string[];
  current_streak: number;
}

export interface ActivityHistoryItem {
  id: string;
  topic: string | null;
  difficulty: Difficulty | null;
  score_pct: number | null;
  time_seconds: number | null;
  created_at: string;
}

export interface ActivityDetail {
  id: string;
  topic: string | null;
  difficulty: Difficulty | null;
  score_pct: number;
  time_seconds: number | null;
  created_at: string;
  questions: SubmittedQuestionResult[];
}

// ---------------------------------------------------------------------------
// Módulos (capítulos gerados por IA) — GET/POST /professores/{id}/modulos
// ---------------------------------------------------------------------------

export interface Module {
  id: string;
  professor_id: string;
  position: number;
  name: string;
  description: string | null;
  topics: string[];
  created_at: string;
  n_tentativas: number;
  melhor_score_pct: number | null;
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

// ---------------------------------------------------------------------------
// Progressão global (XP, nível, sequência) — GET /progresso
// ---------------------------------------------------------------------------

export interface UserProgress {
  total_xp: number;
  level: number;
  xp_no_nivel: number;
  xp_do_nivel: number;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  daily_goal_xp: number;
  xp_hoje: number;
  /** Meta da home, em lições. A meta em XP acima mede o esforço do dia inteiro
   *  (inclusive material indexado) e é a que a tela de configurações ajusta. */
  meta_licoes: number;
  licoes_hoje: number;
}

// ---------------------------------------------------------------------------
// Calendário — GET /calendario
// ---------------------------------------------------------------------------

export type EventKind = "prova" | "revisao" | "tarefa" | "outro";

export interface CalendarEvent {
  id: string;
  professor_id: string | null;
  professor_name: string | null;
  title: string;
  kind: EventKind;
  event_date: string; // YYYY-MM-DD
}

export interface CalendarActivity {
  id: string;
  professor_id: string;
  professor_name: string;
  discipline: string;
  topic: string | null;
  score_pct: number;
  created_at: string;
}

export interface CalendarResponse {
  activities: CalendarActivity[];
  events: CalendarEvent[];
}

// ---------------------------------------------------------------------------
// Biblioteca — GET /documentos (sem professor_id)
// ---------------------------------------------------------------------------

export interface DocumentWithProfessor extends DocumentItem {
  professor_id: string;
  professor_name: string;
  discipline: string;
}
