import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { professorColor } from "@/lib/professor-color";
import type { TopicStat } from "@/lib/types";

// Trilha em zigue-zague — nós grandes conectados, do mais fraco pro mais forte.
// Só existem 2 estados reais (dominado/pendente, vindos de ScoreSummary.topics);
// "disponível"/"bloqueado" exigiriam saber que tópicos existem no material antes
// de qualquer quiz, dado que o app não tem. A acurácia dentro de cada nó dá a
// nuance que falta.
export function TopicTrail({ topics, professorId }: { topics: TopicStat[]; professorId: string }) {
  const color = professorColor(professorId);

  const sorted = [...topics].sort((a, b) => {
    if (a.status !== b.status) return a.status === "pendente" ? -1 : 1;
    return a.accuracy_pct - b.accuracy_pct;
  });

  // Deslocamento horizontal cíclico: centro → direita → centro → esquerda.
  const OFFSETS = ["translate-x-0", "translate-x-16", "translate-x-0", "-translate-x-16"];

  return (
    <ol className="relative mx-auto flex max-w-md flex-col items-center gap-1 py-2">
      {sorted.map((t, i) => {
        const dominado = t.status === "dominado";
        return (
          <li key={t.topico} className="flex w-full flex-col items-center">
            <div className={cn("flex flex-col items-center transition-transform", OFFSETS[i % OFFSETS.length])}>
              <div
                className={cn(
                  "flex h-14 w-14 items-center justify-center rounded-full text-sm font-bold tabular-nums shadow-sm",
                  dominado
                    ? `${color.bg} text-white`
                    : "border-2 border-dashed border-muted-foreground/40 bg-background text-muted-foreground"
                )}
              >
                {dominado ? <Check className="h-6 w-6" strokeWidth={3} /> : `${Math.round(t.accuracy_pct)}%`}
              </div>
              <p className="mt-2 max-w-[11rem] text-center text-sm font-medium leading-snug">{t.topico}</p>
              <p className="text-xs text-muted-foreground">
                {dominado ? `Dominado · ${t.accuracy_pct}%` : `${t.n_questions} ${t.n_questions === 1 ? "questão" : "questões"}`}
              </p>
            </div>

            {i < sorted.length - 1 && <span className="my-2 h-8 w-0.5 rounded-full bg-border" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}
