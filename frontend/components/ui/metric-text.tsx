import * as React from "react";
import { cn } from "@/lib/utils";

// Toda porcentagem, XP, data, contagem e nota do app passa por aqui: SF Mono
// com tabular-nums e -.02em de tracking. É o que faz as colunas alinharem e dá
// o registro de caderneta de notas herdado do prof.ia.
//
// Palavra NUNCA entra em mono — se o conteúdo tem texto junto ("240/400 XP"),
// só o número vai dentro do MetricText e o "XP" fica fora, em SF Pro.

type MetricTone = "tinta" | "fraca" | "indigo" | "acerto" | "erro";

const toneClasses: Record<MetricTone, string> = {
  tinta: "text-tinta",
  fraca: "text-tinta-fraca",
  indigo: "text-indigo",
  acerto: "text-acerto",
  erro: "text-erro",
};

export interface MetricTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: MetricTone;
  /** 590 no valor de linha, 700 no número grande. 400 é o padrão. */
  weight?: "normal" | "semibold" | "bold";
  asChild?: never;
  as?: "span" | "p" | "div";
}

const weightClasses = {
  normal: "font-normal",
  semibold: "font-semibold",
  bold: "font-bold",
} as const;

export function MetricText({
  className,
  tone = "tinta",
  weight = "normal",
  as: Tag = "span",
  ...props
}: MetricTextProps) {
  return (
    <Tag
      className={cn(
        "font-mono tabular-nums tracking-[-0.02em]",
        toneClasses[tone],
        weightClasses[weight],
        className
      )}
      {...props}
    />
  );
}

// Corte de nota do produto: >=70% verde, <40% vermelho, resto neutro. Vale em
// pílula, anel, tabela e trilha — a mesma regra de scoreBadgeVariant em
// lib/utils.ts, traduzida para os tons Kango para não haver duas verdades.
export function toneDaNota(scorePct: number): MetricTone {
  if (scorePct >= 70) return "acerto";
  if (scorePct < 40) return "erro";
  return "tinta";
}
