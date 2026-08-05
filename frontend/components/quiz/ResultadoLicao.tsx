"use client";

import Link from "next/link";
import { Check, Flame, Zap } from "lucide-react";
import { Capsule, capsuleVariants } from "@/components/ui/capsule";
import { Gauge } from "@/components/ui/gauge";
import { GlassCard } from "@/components/ui/glass-card";
import { InlineAlert } from "@/components/ui/inline-alert";
import { KangoPlaceholder } from "@/components/ui/kango-placeholder";
import { MetricText } from "@/components/ui/metric-text";
import { MathText } from "@/components/ui/math-text";
import { pctInteiro } from "@/lib/utils";
import type { ActivitySubmitResult } from "@/lib/types";

/*
  Tela 39 · Resultado da lição.

  O anel de 184 é o assunto da tela, não indicador de canto — por isso ganha
  miolo em vidro e sombra da própria cor (ver ui/gauge.tsx).

  O desenho mostra "42% → 71% de acerto. Anuidades foi liberado." A primeira
  metade exigiria o domínio do tópico ANTES desta tentativa, e o backend não
  guarda esse retrato: ActivitySubmitResult traz só quais tópicos cruzaram o
  limiar agora (topicos_dominados). Então a tela diz o que sabe — quais tópicos
  foram dominados — sem inventar o "de quanto para quanto".
*/

export function ResultadoLicao({
  result,
  topico,
  professorId,
  onRepetir,
  gerando,
  erro,
}: {
  result: ActivitySubmitResult;
  topico: string | null;
  professorId: string;
  onRepetir: () => void;
  gerando: boolean;
  erro: string | null;
}) {
  const certas = result.questions.filter((q) => q.correta).length;
  const total = result.questions.length;
  const dominou = result.topicos_dominados.length > 0;

  return (
    <div className="mx-auto flex max-w-[520px] flex-col items-center text-center">
      <p className="flex items-center gap-[7px] text-rotulo uppercase text-tinta-fraca">
        <span aria-hidden className="h-2 w-2 flex-none rounded-capsula bg-indigo" />
        Lição concluída
      </p>

      <MathText as="p" className="mt-1.5 text-pretty text-titulo-grande text-tinta">
        {topico ?? "Quiz geral"}
      </MathText>

      <Gauge
        className="mt-[22px]"
        value={result.score_pct}
        size="resultado"
        tone="nota"
        label={
          <>
            <MetricText tone="fraca">{certas}</MetricText> de{" "}
            <MetricText tone="fraca">{total}</MetricText> certas
          </>
        }
      >
        {`${pctInteiro(result.score_pct)}%`}
      </Gauge>

      <div className="mt-[22px] flex w-full gap-2.5">
        <GlassCard nivel="hud" radius="cartao" className="flex-1 px-3 py-3.5 text-center">
          <Zap className="mx-auto h-[19px] w-[19px] text-indigo" />
          <MetricText as="p" weight="bold" className="mt-1 text-[22px] leading-none">
            +{result.xp_ganho}
          </MetricText>
          <p className="mt-0.5 text-[12px] text-tinta-fraca">XP</p>
        </GlassCard>

        <GlassCard nivel="hud" radius="cartao" className="flex-1 px-3 py-3.5 text-center">
          <Flame className="mx-auto h-[19px] w-[19px] text-acerto" />
          <MetricText as="p" weight="bold" className="mt-1 text-[22px] leading-none">
            {result.current_streak}
          </MetricText>
          <p className="mt-0.5 text-[12px] text-tinta-fraca">
            {result.current_streak === 1 ? "dia" : "dias"}
          </p>
        </GlassCard>
      </div>

      {dominou && (
        <GlassCard
          nivel="cartao"
          radius="grupo"
          className="mt-3.5 flex w-full items-center gap-3 p-4 text-left"
        >
          <KangoPlaceholder px={60} estado="comemora" />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-corpo font-semibold text-acerto">
              <Check className="h-4 w-4 flex-none" strokeWidth={3} />
              {result.topicos_dominados.length === 1
                ? "Você domina esse tópico"
                : "Você dominou tópicos novos"}
            </p>
            <p className="mt-[3px] text-pretty text-[14px] leading-[1.4] text-tinta-fraca">
              <MathText>{result.topicos_dominados.join(" · ")}</MathText>
            </p>
          </div>
        </GlassCard>
      )}

      {erro && (
        <div className="mt-4 w-full">
          <InlineAlert>{erro}</InlineAlert>
        </div>
      )}

      <div className="mt-6 w-full">
        <Capsule block loading={gerando} onClick={onRepetir}>
          {gerando ? "Gerando..." : "Próxima lição"}
        </Capsule>
        <Link
          href={`/professor/${professorId}`}
          className={capsuleVariants("texto", true, "mt-3")}
        >
          Voltar à trilha
        </Link>
      </div>
    </div>
  );
}
