import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QuizOption } from "./QuizOption";
import type { SubmittedQuestionResult } from "@/lib/types";

export function QuizReview({
  scorePct,
  questions,
  footer,
}: {
  scorePct: number;
  questions: SubmittedQuestionResult[];
  footer?: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-col items-center gap-1 py-8">
          <p className="text-sm text-muted-foreground">Pontuação</p>
          <p className="text-4xl font-bold tabular-nums md:text-5xl">{scorePct}%</p>
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
