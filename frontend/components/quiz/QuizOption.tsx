"use client";

import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

/*
  Alternativa da lição. É uma linha de inset list (56px, sem padding vertical),
  não um cartão: dentro da lição as quatro alternativas são uma lista, e a
  régua tem que bater com a do resto do app.

  A letra vive num círculo de 24px — contornado quando não escolhida, cheio na
  cor do estado quando é. O errado leva risco, e o risco é meio traço na cor do
  erro a 50%, para não competir com o texto da alternativa certa logo abaixo.

  Nenhum estado tira vida ou moeda: elas não existem (handoff §10).
*/

const LETRAS = ["A", "B", "C", "D", "E", "F"];

export type QuizOptionState = "default" | "selected" | "correct" | "incorrect";

export function QuizOption({
  index,
  label,
  state,
  onClick,
  disabled,
  ultima = false,
}: {
  index: number;
  label: string;
  state: QuizOptionState;
  onClick?: () => void;
  disabled?: boolean;
  /** Última da lista: sem separador. */
  ultima?: boolean;
}) {
  const conteudo = (
    <>
      <span
        className={cn(
          "flex h-6 w-6 flex-none items-center justify-center rounded-capsula text-[13px] font-semibold",
          state === "default" && "border border-[hsl(220_10%_56%)] text-tinta-fraca",
          state === "selected" && "bg-indigo text-papel",
          state === "correct" && "bg-acerto text-papel",
          state === "incorrect" && "bg-erro text-papel"
        )}
      >
        {LETRAS[index] ?? index + 1}
      </span>

      <span
        className={cn(
          "flex-1 text-linha",
          (state === "correct" || state === "incorrect" || state === "selected") && "font-semibold",
          state === "incorrect" && "line-through decoration-[hsl(var(--erro)/0.5)]"
        )}
      >
        {label}
      </span>

      {state === "correct" && (
        <Check className="h-[19px] w-[19px] flex-none text-acerto" strokeWidth={3} />
      )}
      {state === "incorrect" && (
        <X className="h-[19px] w-[19px] flex-none text-erro" strokeWidth={3} />
      )}

      {!ultima && (
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-[52px] right-0 h-[0.5px] bg-borda"
        />
      )}
    </>
  );

  const classes = cn(
    "relative flex w-full min-h-linha-campo items-center gap-3 px-4 text-left text-tinta",
    state === "correct" && "bg-acerto/10",
    state === "incorrect" && "bg-erro/10",
    state === "selected" && "bg-indigo/8",
    !disabled && state === "default" && "transition-colors duration-140 ease-out hover:bg-indigo/5",
    "focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte",
    disabled && "pointer-events-none"
  );

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={classes}>
      {conteudo}
    </button>
  );
}
