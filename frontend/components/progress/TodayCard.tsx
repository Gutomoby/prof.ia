"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Capsule, capsuleVariants } from "@/components/ui/capsule";
import { GlassCard } from "@/components/ui/glass-card";
import { InlineAlert } from "@/components/ui/inline-alert";
import { useStartQuiz } from "@/lib/use-start-quiz";
import { professorColor } from "@/lib/professor-color";
import type { GlobalNextStep } from "@/lib/global-next-step";

// "O que fazer hoje" — um único caminho, escolhido entre TODAS as matérias.
// A regra por matéria é a mesma da Sala do professor (lib/next-step.ts); aqui
// só se decide qual matéria é a mais urgente (lib/global-next-step.ts).
//
// Uma cápsula principal por tela: esta é a da tela Estudar. "Ver a matéria" é
// secundária de propósito — se as duas competissem, nenhuma seria o caminho.
export function TodayCard({ globalStep }: { globalStep: GlobalNextStep }) {
  const { professor, step } = globalStep;
  const { start, generating, error } = useStartQuiz(professor.id);
  const color = professorColor(professor.id);

  return (
    <GlassCard nivel="cartao" radius="grupo" className="flex h-full flex-col gap-4 p-6">
      <p className="text-rotulo uppercase text-tinta-fraca">Hoje</p>

      <div>
        <h2 className="text-titulo-cartao text-tinta">{step.title}</h2>
        <p className="mt-1.5 flex items-center gap-2 text-corpo text-tinta-fraca">
          {/* Cor de matéria só como ponto — nunca como fundo de cartão. */}
          <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${color.bg}`} />
          com {professor.name} · {professor.discipline}
        </p>
        <p className="mt-2 text-corpo text-tinta-fraca">{step.description}</p>
      </div>

      {error && <InlineAlert>{error}</InlineAlert>}

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        {step.kind === "subir-material" ? (
          <Link
            href={`/professor/${professor.id}/configurar`}
            className={capsuleVariants("principal")}
          >
            {step.ctaLabel}
            <ArrowRight className="h-[18px] w-[18px]" />
          </Link>
        ) : (
          <Capsule
            onClick={() =>
              step.moduleId
                ? start(null, { moduleId: step.moduleId, rotulo: step.title })
                : start(step.topic)
            }
            loading={generating}
          >
            {generating ? "Gerando..." : step.ctaLabel}
            {!generating && <ArrowRight className="h-[18px] w-[18px]" />}
          </Capsule>
        )}
        <Link href={`/professor/${professor.id}`} className={capsuleVariants("secundaria")}>
          Ver a matéria
        </Link>
      </div>
    </GlassCard>
  );
}
