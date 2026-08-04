"use client";

import { cn } from "@/lib/utils";
import type { Difficulty } from "@/lib/types";

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  facil: "Fácil",
  medio: "Médio",
  dificil: "Difícil",
};

const OPTIONS: Difficulty[] = ["facil", "medio", "dificil"];

/*
  Seletor segmentado de dificuldade — global na tela de quiz: vale tanto para
  quiz de módulo quanto para quiz de tópico livre, para o aluno não ter que
  decidir de novo a cada card.
*/
export function DifficultyPicker({
  value,
  onChange,
  disabled,
}: {
  value: Difficulty;
  onChange: (d: Difficulty) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Dificuldade das questões"
      className="inline-flex rounded-full bg-muted p-1"
    >
      {OPTIONS.map((d) => (
        <button
          key={d}
          type="button"
          role="radio"
          aria-checked={value === d}
          disabled={disabled}
          onClick={() => onChange(d)}
          className={cn(
            "rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
            value === d
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {DIFFICULTY_LABELS[d]}
        </button>
      ))}
    </div>
  );
}
