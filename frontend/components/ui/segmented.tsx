"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// Segmented control do iOS. Trilho em cinza tonal, aba ativa em papel com
// sombra curta — a ativa "sobe" do trilho, não muda de cor.
//
// Desktop só cresce o raio, o padding e o texto (13 -> 15). Os tokens de cor
// são os mesmos: o computador não tem escala própria.

export interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
}

export interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  size?: "mobile" | "desktop";
  /** Rótulo acessível do grupo (ex.: "Período do progresso"). */
  "aria-label"?: string;
  className?: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onValueChange,
  size = "mobile",
  className,
  ...props
}: SegmentedProps<T>) {
  const desktop = size === "desktop";

  return (
    <div
      role="tablist"
      aria-label={props["aria-label"]}
      className={cn(
        "flex w-full bg-cinza-tonal",
        desktop ? "rounded-[11px] p-[3px]" : "rounded-[9px] p-0.5",
        className
      )}
    >
      {options.map((option) => {
        const ativa = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={ativa}
            onClick={() => onValueChange(option.value)}
            className={cn(
              "flex-1 text-center transition-all duration-180 ease-out",
              "focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte",
              // Raio e padding da aba são diferentes por tamanho: 7/6px no
              // celular, 8/8px no desktop. Medido nas telas.
              desktop ? "rounded-[8px] py-2 text-[15px]" : "rounded-[7px] py-1.5 text-nota",
              ativa
                ? "bg-papel font-semibold text-tinta shadow-segmentada"
                : // Inativa é 510 em tinta fraca. O hover pinta o trilho de
                  // branco a 60% — mesma regra da aba inativa no desktop.
                  "font-medium text-tinta-fraca hover:bg-white/60"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
