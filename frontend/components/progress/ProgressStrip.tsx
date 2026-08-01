import { Flame, Zap } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { UserProgress } from "@/lib/types";

// Linha única de estado pessoal — sequência, nível e XP. Substitui os 3 KPIs
// antigos do dashboard: "domínio médio" e "streak combinado" misturavam
// matérias de um jeito que não queria dizer nada. Sequência e nível são
// conceitos por pessoa, e agora vêm calculados do backend (GET /progresso).
export function ProgressStrip({ progress, loading }: { progress: UserProgress | null; loading: boolean }) {
  if (loading || !progress) {
    return <Skeleton className="h-16 rounded-2xl" />;
  }

  const pctNoNivel = Math.round((progress.xp_no_nivel / progress.xp_do_nivel) * 100);

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
    </div>
  );
}
