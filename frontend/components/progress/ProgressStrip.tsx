import { Flame, Target, Zap } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { UserProgress } from "@/lib/types";

// Anel de progresso da meta diária. Âmbar (cor de ação/gamificação) enquanto
// está em andamento; verde quando a meta do dia fecha.
function GoalRing({ pct, done }: { pct: number; done: boolean }) {
  const r = 15;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 36 36" className="h-10 w-10 shrink-0 -rotate-90" aria-hidden>
      <circle cx="18" cy="18" r={r} fill="none" strokeWidth="4" className="stroke-border" />
      <circle
        cx="18"
        cy="18"
        r={r}
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={`${(pct / 100) * c} ${c}`}
        className={done ? "stroke-success" : "stroke-action"}
        style={{ transition: "stroke-dasharray 0.5s ease" }}
      />
    </svg>
  );
}

// Linha única de estado pessoal — sequência, nível/XP e meta diária. Sequência,
// nível e meta são conceitos por pessoa (não por matéria) e vêm calculados do
// backend (GET /progresso).
export function ProgressStrip({ progress, loading }: { progress: UserProgress | null; loading: boolean }) {
  if (loading || !progress) {
    return <Skeleton className="h-16 rounded-2xl" />;
  }

  const pctNoNivel = Math.round((progress.xp_no_nivel / progress.xp_do_nivel) * 100);
  const goalPct = Math.min(100, Math.round((progress.xp_hoje / progress.daily_goal_xp) * 100));
  const goalDone = progress.xp_hoje >= progress.daily_goal_xp;

  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-4 rounded-2xl bg-muted/50 px-6 py-5 dark:bg-muted/25">
      <div className="flex items-center gap-2.5">
        <Flame className={progress.current_streak > 0 ? "h-5 w-5 text-success" : "h-5 w-5 text-muted-foreground"} />
        <div>
          <p className="metric text-lg font-bold leading-tight">
            {progress.current_streak} {progress.current_streak === 1 ? "dia" : "dias"}
          </p>
          <p className="text-xs text-muted-foreground">
            {progress.current_streak > 0 ? "seguidos" : "Estude hoje pra recomeçar"}
          </p>
        </div>
      </div>

      <div className="flex min-w-[12rem] flex-1 items-center gap-2.5">
        <Zap className="h-5 w-5 text-primary" />
        <div className="flex-1">
          <p className="text-lg font-bold leading-tight">
            Nível <span className="metric">{progress.level}</span>
          </p>
          <div className="mt-1 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500"
                style={{ width: `${pctNoNivel}%` }}
              />
            </div>
            <span className="metric shrink-0 text-xs text-muted-foreground">
              {progress.xp_no_nivel}/{progress.xp_do_nivel} XP
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <div className="relative">
          <GoalRing pct={goalPct} done={goalDone} />
          <Target
            className={`absolute inset-0 m-auto h-4 w-4 ${goalDone ? "text-success" : "text-action"}`}
          />
        </div>
        <div>
          <p className="metric text-lg font-bold leading-tight">
            {progress.xp_hoje}/{progress.daily_goal_xp} XP
          </p>
          <p className="text-xs text-muted-foreground">
            {goalDone ? "Meta do dia batida! 🎉" : "Meta diária"}
          </p>
        </div>
      </div>
    </div>
  );
}
