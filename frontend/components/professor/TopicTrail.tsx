import { Badge } from "@/components/ui/badge";
import { cn, scoreBadgeVariant } from "@/lib/utils";
import type { TopicStat } from "@/lib/types";

// Trilha vertical dos tópicos já testados — pendentes primeiro (do mais fraco
// pro mais forte), depois os dominados. Na prática é a mesma prioridade do
// "próximo passo", só que completa. Só 2 estados reais (dominado/pendente,
// vindos de ScoreSummary.topics) — sem "disponível"/"bloqueado", que exigiriam
// saber quais tópicos existem no material antes de qualquer quiz, dado que o
// app não tem hoje.
export function TopicTrail({ topics }: { topics: TopicStat[] }) {
  const sorted = [...topics].sort((a, b) => {
    if (a.status !== b.status) return a.status === "pendente" ? -1 : 1;
    return a.accuracy_pct - b.accuracy_pct;
  });

  return (
    <ol>
      {sorted.map((t, i) => {
        const dominado = t.status === "dominado";
        return (
          <li key={t.topico} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "mt-1 h-3 w-3 shrink-0 rounded-full",
                  dominado ? "bg-success" : "border-2 border-muted-foreground/40 bg-background"
                )}
              />
              {i < sorted.length - 1 && <span className="w-px flex-1 bg-border/60" />}
            </div>
            <div className="flex flex-1 items-center justify-between gap-4 pb-5">
              <span className="text-sm">{t.topico}</span>
              <Badge variant={scoreBadgeVariant(t.accuracy_pct)}>{t.accuracy_pct}%</Badge>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
