"use client";

import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

export type QuizOptionState = "default" | "selected" | "correct" | "incorrect";

export function QuizOption({
  index,
  label,
  state,
  onClick,
  disabled,
}: {
  index: number;
  label: string;
  state: QuizOptionState;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        state === "default" && "border-input bg-background hover:border-primary/40 hover:bg-accent",
        state === "selected" && "border-primary bg-primary/5",
        state === "correct" && "border-success bg-success/10",
        state === "incorrect" && "border-destructive bg-destructive/10",
        disabled ? "pointer-events-none" : "cursor-pointer"
      )}
    >
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
          state === "default" && "border-input text-muted-foreground",
          state === "selected" && "border-primary bg-primary text-primary-foreground",
          state === "correct" && "border-success bg-success text-success-foreground",
          state === "incorrect" && "border-destructive bg-destructive text-destructive-foreground"
        )}
      >
        {LETTERS[index] ?? index + 1}
      </span>
      <span className="flex-1">{label}</span>
      {state === "correct" && <Check className="h-4 w-4 shrink-0 text-success" />}
      {state === "incorrect" && <X className="h-4 w-4 shrink-0 text-destructive" />}
    </button>
  );
}
