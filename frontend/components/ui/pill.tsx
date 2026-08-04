import * as React from "react";
import { cn } from "@/lib/utils";
import { scoreBadgeVariant } from "@/lib/utils";

/*
  Pílula — o chip tonal do handoff (§06 "Segmented e pílulas"): fundo da cor a
  12%, texto na cor cheia, 12px/590, raio de cápsula.

  Não confunda com Capsule: aquela é ação (botão, 44–52px de alvo de toque),
  esta é rótulo (não clica, 22px de altura). "68% você já domina", "dominado",
  "prioridade", "dia de prova".

  O neutro foge do padrão tonal de propósito: cinza tonal é cor cheia, não uma
  cor de acento a 12% — é o trilho do segmented, o mesmo tom.
*/

export type PillTone = "acerto" | "erro" | "indigo" | "neutro";

const toneClasses: Record<PillTone, string> = {
  acerto: "bg-acerto/12 text-acerto",
  erro: "bg-erro/12 text-erro",
  indigo: "bg-indigo/12 text-indigo",
  neutro: "bg-cinza-tonal text-tinta-fraca",
};

export interface PillProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: PillTone;
}

export function Pill({ tone = "neutro", className, ...props }: PillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-capsula px-[9px] py-0.5",
        "text-[12px] font-semibold",
        toneClasses[tone],
        className
      )}
      {...props}
    />
  );
}

// Corte de nota traduzido para os tons da pílula. Deriva de scoreBadgeVariant
// para não criar uma terceira verdade sobre o mesmo corte — a régua vive em
// lib/utils.ts e já é compartilhada com o badge antigo e com toneDaNota.
//
// Atenção ao ler o handoff: a tela 14 pinta "68% você já domina" de verde, mas
// o corte está escrito duas vezes no guia (§06 e §10) como >=70%. Vale a regra;
// 68% sai neutro aqui.
const DA_NOTA = {
  success: "acerto",
  destructive: "erro",
  neutral: "neutro",
} as const satisfies Record<ReturnType<typeof scoreBadgeVariant>, PillTone>;

export function tonePilulaDaNota(scorePct: number): PillTone {
  return DA_NOTA[scoreBadgeVariant(scorePct)];
}
