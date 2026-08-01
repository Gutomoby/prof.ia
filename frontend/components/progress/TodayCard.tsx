"use client";

import Link from "next/link";
import { ArrowRight, Sun } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InlineAlert } from "@/components/ui/inline-alert";
import { useStartQuiz } from "@/lib/use-start-quiz";
import { professorColor } from "@/lib/professor-color";
import type { GlobalNextStep } from "@/lib/global-next-step";

// "O que fazer hoje" — um único caminho, escolhido entre TODAS as matérias.
// A regra por matéria é a mesma da Sala do professor (lib/next-step.ts); aqui
// só se decide qual matéria é a mais urgente (lib/global-next-step.ts).
export function TodayCard({ globalStep }: { globalStep: GlobalNextStep }) {
  const { professor, step } = globalStep;
  const { start, generating, error } = useStartQuiz(professor.id);
  const color = professorColor(professor.id);

  return (
    <Card variant="elevated" className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Sun className="h-3.5 w-3.5" />
          Hoje
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xl font-semibold">{step.title}</p>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${color.bg}`} />
            com {professor.name} · {professor.discipline}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
        </div>

        {error && <InlineAlert>{error}</InlineAlert>}

        <div className="flex flex-wrap gap-2">
          {step.kind === "subir-material" ? (
            <Link href={`/professor/${professor.id}/configurar`} className={buttonVariants("default", "lg")}>
              {step.ctaLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <Button onClick={() => start(step.topic)} loading={generating} size="lg">
              <ArrowRight className="h-4 w-4" />
              {generating ? "Gerando..." : step.ctaLabel}
            </Button>
          )}
          <Link href={`/professor/${professor.id}`} className={buttonVariants("ghost", "lg")}>
            Ver a matéria
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
