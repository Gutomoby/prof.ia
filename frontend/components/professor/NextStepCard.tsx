"use client";

import Link from "next/link";
import { ArrowRight, Compass } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InlineAlert } from "@/components/ui/inline-alert";
import { useStartQuiz } from "@/lib/use-start-quiz";
import type { NextStep } from "@/lib/next-step";

// Card único e sempre presente da Sala do professor — nunca um menu de opções.
export function NextStepCard({ professorId, nextStep }: { professorId: string; nextStep: NextStep }) {
  const { start, generating, error } = useStartQuiz(professorId);

  return (
    <Card variant="elevated" className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Compass className="h-3.5 w-3.5" />
          Próximo passo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-lg font-semibold">{nextStep.title}</p>
          <p className="text-sm text-muted-foreground">{nextStep.description}</p>
        </div>

        {error && <InlineAlert>{error}</InlineAlert>}

        {nextStep.kind === "subir-material" ? (
          <Link href={`/professor/${professorId}/configurar`} className={buttonVariants("default", "lg")}>
            {nextStep.ctaLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : (
          <Button onClick={() => start(nextStep.topic)} loading={generating} size="lg">
            <ArrowRight className="h-4 w-4" />
            {generating ? "Gerando..." : nextStep.ctaLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
