import * as React from "react";
import { cn } from "@/lib/utils";
import { MetricText } from "@/components/ui/metric-text";

// Anel de domínio. conic-gradient com miolo do papel — sem SVG, sem
// stroke-dasharray: o gradiente cônico já é a régua, e o miolo é só um
// círculo menor por cima.
//
// Índigo mede domínio, verde mede meta cumprida. O corte de nota (>=70 verde,
// <40 vermelho) fica em tone="nota".

type GaugeTone = "indigo" | "acerto" | "erro" | "nota";

const TRILHA = "hsl(var(--borda))";

const toneFill: Record<Exclude<GaugeTone, "nota">, string> = {
  indigo: "hsl(var(--indigo))",
  acerto: "hsl(var(--acerto))",
  erro: "hsl(var(--erro))",
};

function resolveTone(tone: GaugeTone, pct: number): Exclude<GaugeTone, "nota"> {
  if (tone !== "nota") return tone;
  if (pct >= 70) return "acerto";
  if (pct < 40) return "erro";
  return "indigo";
}

// Todos os anéis das 81 telas, medidos no HTML — o miolo é o valor real, e a
// espessura sai da diferença. Não há fórmula: 76 tem anel de 8 e 84 tem 9,
// então a tabela é a fonte da verdade.
//   diâmetro: [miolo, texto, rótulo]
const ANEIS: Record<number, { inner: number; text: string; label: string }> = {
  72: { inner: 56, text: "text-[18px]", label: "text-[11px]" },
  76: { inner: 60, text: "text-[18px]", label: "text-[11px]" },
  84: { inner: 66, text: "text-[20px]", label: "text-[11px]" },
  96: { inner: 76, text: "text-[22px]", label: "text-[12px]" },
  132: { inner: 106, text: "text-[30px]", label: "text-nota" },
  184: { inner: 150, text: "text-[44px]", label: "text-[12px]" },
  196: { inner: 160, text: "text-[48px]", label: "text-[12px]" },
};

// Apelidos por papel, para as telas não escreverem número solto.
const NOMES = { cartao: 76, guia: 84, desktop: 132, resultado: 184 } as const;

// Os dois maiores são o assunto da tela (resultado da lição), não indicador de
// canto: ganham miolo em vidro e sombra da própria cor.
const SOMBRA: Record<number, string> = {
  184: "0 14px 34px hsl(var(--indigo) / .2)",
  196: "0 16px 40px hsl(var(--indigo) / .22)",
};
const MIOLO_VIDRO = new Set([184]);

export interface GaugeProps {
  /** 0 a 100. Valores fora da faixa são grampeados. */
  value: number;
  /** Apelido por papel, ou o diâmetro em px de uma das telas. */
  size?: keyof typeof NOMES | keyof typeof ANEIS;
  tone?: GaugeTone;
  /** Conteúdo do miolo. O padrão é o próprio valor com "%". */
  children?: React.ReactNode;
  /** Rótulo abaixo do número, dentro do miolo. */
  label?: React.ReactNode;
  className?: string;
}

export function Gauge({
  value,
  size = "cartao",
  tone = "indigo",
  children,
  label,
  className,
}: GaugeProps) {
  const pct = Math.min(100, Math.max(0, value));
  const px = typeof size === "number" ? size : NOMES[size];
  const spec = ANEIS[px];
  const fill = toneFill[resolveTone(tone, pct)];
  const vidro = MIOLO_VIDRO.has(px);

  return (
    <div
      role="img"
      aria-label={typeof children === "string" ? children : `${Math.round(pct)}%`}
      className={cn("relative flex flex-none items-center justify-center rounded-capsula", className)}
      style={{
        width: px,
        height: px,
        background: `conic-gradient(${fill} 0 ${pct}%, ${TRILHA} ${pct}% 100%)`,
        boxShadow: SOMBRA[px],
        // .4s no anel — a régua se preenche, não pisca.
        transition: "background 400ms ease-out",
      }}
    >
      <div
        className={cn(
          "flex flex-col items-center justify-center rounded-capsula",
          vidro ? "vidro-cartao" : "bg-papel"
        )}
        style={{
          width: spec.inner,
          height: spec.inner,
          // O miolo do 184 é rgba(255,255,255,.82), fora da escala de .vidro-*.
          background: vidro ? "rgba(255, 255, 255, .82)" : undefined,
        }}
      >
        <MetricText weight="bold" className={spec.text}>
          {children ?? `${Math.round(pct)}%`}
        </MetricText>
        {label && (
          <span className={cn("mt-0.5 font-semibold text-tinta-fraca", spec.label)}>{label}</span>
        )}
      </div>
    </div>
  );
}

// Barra de progresso, o par do anel na mesma seção do guia: 8px na lição
// (domínio, índigo) e 6px na meta do dia (verde quando cumprida).
export interface ProgressBarProps {
  value: number;
  tone?: "indigo" | "acerto";
  espessura?: "licao" | "meta";
  className?: string;
  "aria-label"?: string;
}

export function ProgressBar({
  value,
  tone = "indigo",
  espessura = "licao",
  className,
  ...props
}: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, value));

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={props["aria-label"]}
      className={cn(
        "w-full overflow-hidden rounded-capsula",
        espessura === "licao" ? "h-2 bg-cinza-tonal" : "h-1.5 bg-borda",
        className
      )}
    >
      <div
        className={cn(
          "h-full rounded-capsula transition-[width] duration-400 ease-out",
          tone === "indigo" ? "bg-indigo" : "bg-acerto"
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
