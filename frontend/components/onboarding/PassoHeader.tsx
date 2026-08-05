"use client";

import { ChevronLeft } from "lucide-react";
import { MetricText } from "@/components/ui/metric-text";
import { cn } from "@/lib/utils";

/*
  Cabeçalho dos passos do primeiro acesso (telas 06, 07, 08 e 10): voltar,
  barra de 5px e "N de 3".

  A barra fica verde no 3 de 3 — é o único lugar do fluxo em que o índigo sai
  de cena, e ele sai porque ali a barra não mede mais progresso, ela confirma
  que acabou.

  "N de 3" tem palavra no meio, então só os números entram em mono: é a regra
  do MetricText, e é o que separa este componente do desenho, onde a linha
  inteira está em SF Mono.
*/
export function PassoHeader({
  passo,
  onVoltar,
}: {
  passo: 1 | 2 | 3;
  /** Sem callback, o chevron não aparece — 08 e 10 não têm volta. */
  onVoltar?: () => void;
}) {
  const largura = passo === 1 ? "33%" : passo === 2 ? "66%" : "100%";

  return (
    <div className="flex flex-none items-center gap-3">
      {onVoltar && (
        <button
          type="button"
          onClick={onVoltar}
          aria-label="Voltar"
          className={cn(
            "-ml-2 flex h-toque w-8 flex-none items-center justify-center rounded-chip text-indigo",
            "transition-colors duration-140 ease-out hover:bg-indigo/6",
            "focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte"
          )}
        >
          <ChevronLeft className="h-[19px] w-[19px]" />
        </button>
      )}

      <div
        role="progressbar"
        aria-valuenow={passo}
        aria-valuemin={1}
        aria-valuemax={3}
        aria-label={`Passo ${passo} de 3`}
        className="h-[5px] flex-1 overflow-hidden rounded-capsula bg-cinza-tonal"
      >
        <div
          className={cn(
            "h-full rounded-capsula transition-[width] duration-400 ease-out",
            passo === 3 ? "bg-acerto" : "bg-indigo"
          )}
          style={{ width: largura }}
        />
      </div>

      <span className="flex-none text-[12px] text-tinta-fraca">
        <MetricText tone="fraca">{passo}</MetricText> de <MetricText tone="fraca">3</MetricText>
      </span>
    </div>
  );
}
