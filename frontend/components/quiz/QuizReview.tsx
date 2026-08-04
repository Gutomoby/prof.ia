import { Flame, Trophy, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QuizOption } from "./QuizOption";
import { pctInteiro } from "@/lib/utils";
import type { SubmittedQuestionResult } from "@/lib/types";

export function QuizReview({
  scorePct,
  questions,
  reward,
  footer,
}: {
  scorePct: number;
  questions: SubmittedQuestionResult[];
  // Só existe logo depois de submeter — ao revisitar do histórico não há
  // recompensa nova a mostrar.
  reward?: { xpGanho: number; topicosDominados: string[]; currentStreak: number };
  footer?: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-col items-center gap-1 py-8">
          <p className="text-sm text-muted-foreground">Pontuação</p>
          <p className="text-4xl font-bold metric md:text-5xl">{pctInteiro(scorePct)}%</p>

          {reward && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                <Zap className="h-4 w-4 text-primary" />
                <span className="metric">+{reward.xpGanho} XP</span>
              </span>
              {reward.currentStreak > 0 && (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                  <Flame className="h-4 w-4 text-success" />
                  <span className="metric">
                    {reward.currentStreak} {reward.currentStreak === 1 ? "dia" : "dias"}
                  </span>
                </span>
              )}
            </div>
          )}

          {reward && reward.topicosDominados.length > 0 && (
            <p className="mt-3 inline-flex items-center gap-1.5 text-center text-sm text-success">
              <Trophy className="h-4 w-4 shrink-0" />
              Você dominou {reward.topicosDominados.join(", ")}.
            </p>
          )}
        </CardContent>
      </Card>

      {questions.map((q, qi) => (
        <Card key={qi}>
          <CardHeader>
            <CardTitle>
              {qi + 1}. {q.enunciado}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {q.alternativas.map((alt, ai) => {
              const state =
                ai === q.resposta_correta ? "correct" : ai === q.resposta_usuario ? "incorrect" : "default";
              return <QuizOption key={ai} index={ai} label={alt} state={state} disabled />;
            })}
            <p className="pt-2 text-sm text-muted-foreground">{q.explicacao}</p>
          </CardContent>
        </Card>
      ))}

      {footer}
    </div>
  );
}
