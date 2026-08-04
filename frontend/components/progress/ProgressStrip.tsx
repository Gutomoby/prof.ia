import { Flame, Target, Zap } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { MetricText } from "@/components/ui/metric-text";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { UserProgress } from "@/lib/types";

// Anel da meta diária. Índigo enquanto está em andamento, verde quando fecha —
// o âmbar saiu junto com a paleta antiga.
function GoalRing({ pct, done }: { pct: number; done: boolean }) {
  const r = 15;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 36 36" className="h-10 w-10 shrink-0 -rotate-90" aria-hidden>
      <circle cx="18" cy="18" r={r} fill="none" strokeWidth="4" className="stroke-borda" />
      <circle
        cx="18"
        cy="18"
        r={r}
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={`${(pct / 100) * c} ${c}`}
        className={done ? "stroke-acerto" : "stroke-indigo"}
        // .4s é a duração de anel e barra de progresso no sistema.
        style={{ transition: "stroke-dasharray 400ms ease" }}
      />
    </svg>
  );
}

// Pílula de HUD em vidro .80 — sequência, nível e meta do dia. São conceitos
// por pessoa (não por matéria) e vêm calculados de GET /progresso.
//
// A meta é medida em XP, não em lições: é o que o backend entrega hoje
// (daily_goal_xp / xp_hoje) e não vale inventar uma contagem no cliente que o
// servidor não sabe confirmar.
export function ProgressStrip({ progress, loading }: { progress: UserProgress | null; loading: boolean }) {
  if (loading || !progress) {
    return <Skeleton className="h-[92px] rounded-grupo" />;
  }

  const pctNoNivel = Math.round((progress.xp_no_nivel / progress.xp_do_nivel) * 100);
  const goalPct = Math.min(100, Math.round((progress.xp_hoje / progress.daily_goal_xp) * 100));
  const goalDone = progress.xp_hoje >= progress.daily_goal_xp;
  const temSequencia = progress.current_streak > 0;

  return (
    <GlassCard
      nivel="hud"
      radius="grupo"
      className={cn(
        // A tela 14 tem duas caixas no HUD (sequência e nível); a meta do dia
        // veio da tela 20. Com três, o flex-wrap jogava a meta sozinha numa
        // segunda linha, desalinhada.
        //
        // No celular vira grade: sequência e meta dividem a primeira linha,
        // nível ocupa a segunda inteira — é a única que tem barra e precisa de
        // largura. Da largura sm em diante volta a ser uma linha só.
        "grid grid-cols-2 items-center gap-x-6 gap-y-5 px-6 py-5",
        "sm:flex sm:flex-wrap sm:gap-x-8"
      )}
    >
      {/* Sequência */}
      <div className="order-1 flex items-center gap-2.5">
        <Flame className={temSequencia ? "h-5 w-5 text-acerto" : "h-5 w-5 text-tinta-fraca"} />
        <div>
          <p className="text-titulo-cartao leading-none">
            <MetricText weight="bold">{progress.current_streak}</MetricText>{" "}
            <span className="text-linha font-semibold text-tinta">
              {progress.current_streak === 1 ? "dia" : "dias"}
            </span>
          </p>
          <p className="mt-1 text-nota text-tinta-fraca">
            {temSequencia ? "seguidos" : "Estude hoje pra recomeçar"}
          </p>
        </div>
      </div>

      {/* Nível e XP acumulado */}
      <div className="order-3 col-span-2 flex items-center gap-2.5 sm:order-2 sm:min-w-[12rem] sm:flex-1">
        <Zap className="h-5 w-5 text-indigo" />
        <div className="flex-1">
          <p className="text-linha font-semibold text-tinta">
            Nível <MetricText weight="bold">{progress.level}</MetricText>
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-capsula bg-borda">
              <div
                className="h-full rounded-capsula bg-indigo transition-[width] duration-400 ease-out"
                style={{ width: `${pctNoNivel}%` }}
              />
            </div>
            <span className="shrink-0 text-nota text-tinta-fraca">
              <MetricText tone="fraca">
                {progress.xp_no_nivel}/{progress.xp_do_nivel}
              </MetricText>{" "}
              XP
            </span>
          </div>
        </div>
      </div>

      {/* Meta do dia */}
      <div className="order-2 flex items-center gap-2.5 sm:order-3">
        <div className="relative">
          <GoalRing pct={goalPct} done={goalDone} />
          <Target
            className={`absolute inset-0 m-auto h-4 w-4 ${goalDone ? "text-acerto" : "text-indigo"}`}
          />
        </div>
        <div>
          <p className="text-titulo-cartao leading-none">
            <MetricText weight="bold" tone={goalDone ? "acerto" : "tinta"}>
              {progress.xp_hoje}/{progress.daily_goal_xp}
            </MetricText>{" "}
            <span className="text-linha font-semibold text-tinta">XP</span>
          </p>
          <p className="mt-1 text-nota text-tinta-fraca">
            {goalDone ? "Meta do dia batida!" : "Meta diária"}
          </p>
        </div>
      </div>
    </GlassCard>
  );
}
