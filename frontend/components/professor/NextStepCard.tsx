"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Compass } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InlineAlert } from "@/components/ui/inline-alert";
import type { NextStep } from "@/lib/next-step";

function pendingQuizKey(professorId: string) {
  return `pending-quiz-${professorId}`;
}

// Card único e sempre presente da Sala do professor — nunca um menu de
// opções. Pra "subir-material" é só um link; nos outros casos gera o quiz
// (eventualmente escopado a um tópico) e entrega pro /quiz via sessionStorage,
// reaproveitando o mesmo handoff que "Tentar novamente" já usa no histórico.
export function NextStepCard({ professorId, nextStep }: { professorId: string; nextStep: NextStep }) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    setError(null);
    setGenerating(true);
    try {
      const generated = await api.generateAtividade({ professor_id: professorId, topic: nextStep.topic });
      sessionStorage.setItem(pendingQuizKey(professorId), JSON.stringify(generated));
      router.push(`/professor/${professorId}/quiz`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao gerar o quiz.");
      setGenerating(false);
    }
  }

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
          <Button onClick={handleStart} loading={generating} size="lg">
            <ArrowRight className="h-4 w-4" />
            {generating ? "Gerando..." : nextStep.ctaLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
