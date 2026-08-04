import * as React from "react";
import { Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { MetricText } from "@/components/ui/metric-text";

// Nó da trilha de tópicos. Três estados, e a diferença entre eles é a forma do
// anel, não só a cor:
//
//  dominado   círculo verde cheio com check (traço 3)
//  atual      contorno índigo de 2px + halo de 4px a 14%, com a acurácia dentro
//  bloqueado  contorno tracejado, cadeado, e o motivo escrito no subtítulo
//
// Regra do produto: o bloqueado diz POR QUE está bloqueado ("Libera quando
// você dominar o anterior"), nunca só "bloqueado". "Dominado" é 70% duas vezes.

export type TopicEstado = "dominado" | "atual" | "bloqueado";

export interface TopicNodeProps {
  estado: TopicEstado;
  nome: React.ReactNode;
  /** Motivo, progresso ou próximo passo. Obrigatório no bloqueado. */
  detalhe?: React.ReactNode;
  /** Acurácia 0–100. Só aparece no estado "atual". */
  pct?: number;
  /** Linha vertical até o próximo nó. Desligue no último. */
  conector?: boolean;
  href?: string;
  className?: string;
}

export function TopicNode({
  estado,
  nome,
  detalhe,
  pct,
  conector = false,
  href,
  className,
}: TopicNodeProps) {
  const no = (
    <span
      aria-hidden
      className={cn(
        "flex h-10 w-10 flex-none items-center justify-center rounded-capsula",
        estado === "dominado" && "bg-acerto text-papel",
        estado === "atual" && "border-2 border-indigo bg-papel shadow-[0_0_0_4px_hsl(var(--indigo)/0.14)]",
        estado === "bloqueado" && "border-2 border-dashed border-borda-forte bg-papel"
      )}
    >
      {estado === "dominado" && <Check className="h-5 w-5" strokeWidth={3} />}
      {estado === "atual" && (
        <MetricText tone="indigo" weight="bold" className="text-nota">
          {pct !== undefined ? `${Math.round(pct)}%` : ""}
        </MetricText>
      )}
      {estado === "bloqueado" && <Lock className="h-[17px] w-[17px] text-tinta-fraca" />}
    </span>
  );

  const conteudo = (
    <>
      <span className="flex items-center gap-3.5">
        {no}
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block text-[16px] tracking-[-0.43px]",
              estado === "atual" ? "font-bold text-tinta" : "font-semibold",
              estado === "bloqueado" ? "text-tinta-fraca" : "text-tinta"
            )}
          >
            {nome}
          </span>
          {detalhe && (
            <span
              className={cn(
                "mt-0.5 block text-nota",
                estado === "atual" ? "text-indigo" : "text-tinta-fraca"
              )}
            >
              {detalhe}
            </span>
          )}
        </span>
      </span>

      {/* Conector alinhado ao centro do nó (20px = metade dos 40px). */}
      {conector && <span aria-hidden className="ml-5 block h-4 w-0.5 -translate-x-px bg-borda" />}
    </>
  );

  if (href && estado !== "bloqueado") {
    return (
      <a
        href={href}
        className={cn(
          "block rounded-chip transition-colors duration-140 ease-out hover:bg-indigo/5",
          "focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte",
          className
        )}
      >
        {conteudo}
      </a>
    );
  }

  return <div className={className}>{conteudo}</div>;
}
