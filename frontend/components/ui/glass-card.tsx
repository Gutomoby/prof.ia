import * as React from "react";
import { cn } from "@/lib/utils";

// Liquid Glass. O material só existe sobre o papel de parede (degradê + halos):
// sobre branco chapado ele some. Use dentro de um container com
// .papel-de-parede e overflow-hidden.
//
// A opacidade é função, não gosto — .86 carrega texto pequeno, .74 é o piso
// absoluto porque abaixo disso o texto de 13px perde contraste.

type GlassNivel = "cartao" | "hud" | "abas" | "sidebar";

const nivelClasses: Record<GlassNivel, string> = {
  // .86 — cartão com texto pequeno. O caso comum.
  cartao: "vidro-cartao shadow-vidro",
  // .80 — pílula de HUD (sequência, XP, nível).
  hud: "vidro-hud shadow-vidro",
  // .74 — barra de abas: flutua SOBRE o conteúdo, por isso a sombra maior.
  abas: "vidro-abas shadow-vidro-flutuante",
  // .55 — sidebar de 296px do desktop, que substitui a barra de abas.
  sidebar: "vidro-sidebar",
};

type GlassRadius = "grupo" | "cartao" | "alerta" | "chip" | "capsula" | "none";

const radiusClasses: Record<GlassRadius, string> = {
  grupo: "rounded-grupo",
  cartao: "rounded-cartao",
  alerta: "rounded-alerta",
  chip: "rounded-chip",
  capsula: "rounded-capsula",
  none: "",
};

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  nivel?: GlassNivel;
  radius?: GlassRadius;
  /** Cartão que abre tela: sobe 2px no hover. Só onde há navegação. */
  interativo?: boolean;
}

export function GlassCard({
  className,
  nivel = "cartao",
  radius = "grupo",
  interativo = false,
  ...props
}: GlassCardProps) {
  return (
    <div
      className={cn(
        nivelClasses[nivel],
        radiusClasses[radius],
        nivel === "sidebar" && "border-r-[0.5px] border-borda",
        interativo &&
          "cursor-pointer transition-all duration-180 ease-out hover:-translate-y-0.5 hover:shadow-cartao-hover",
        className
      )}
      {...props}
    />
  );
}
