import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Helper padrão do shadcn/ui — combina classes condicionais e remove duplicatas
// de forma compatível com Tailwind. Use em todos os componentes:
//   <div className={cn("p-4", isActive && "bg-primary")} />
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Mesmo corte usado em toda exibição de score (badge do histórico de quiz,
// tópicos dominados/pendentes no Início): >=70% sucesso, <40% erro, resto neutro.
export function scoreBadgeVariant(scorePct: number): "success" | "destructive" | "neutral" {
  if (scorePct >= 70) return "success";
  if (scorePct < 40) return "destructive";
  return "neutral";
}

function toUtcDateKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function shiftUtcDateKey(dateKey: string, deltaDays: number): string {
  const d = new Date(`${dateKey}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

// Streak "cross-matéria": um dia conta se o aluno estudou QUALQUER matéria
// naquele dia — diferente do streak_days que cada GET /score/{id} devolve
// isolado por matéria. Mesma regra de backend/services/scoring.py::compute_streak
// (dias consecutivos terminando hoje ou ontem), só que operando sobre as datas
// de score_trend de todas as matérias combinadas.
export function computeCombinedStreak(isoDates: string[]): number {
  if (isoDates.length === 0) return 0;

  const uniqueDates = new Set(isoDates.map(toUtcDateKey));
  const today = new Date().toISOString().slice(0, 10);
  const anchor = uniqueDates.has(today) ? today : shiftUtcDateKey(today, -1);
  if (!uniqueDates.has(anchor)) return 0;

  let streak = 0;
  let cursor = anchor;
  while (uniqueDates.has(cursor)) {
    streak += 1;
    cursor = shiftUtcDateKey(cursor, -1);
  }
  return streak;
}
