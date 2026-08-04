import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Cápsulas — a escada de ação do Kango, em quatro degraus.
//
// UMA principal por tela. Se duas competem, uma delas vira secundária ou
// tonal. "texto" é a terceira opção, reservada para ação de saída
// ("Agora não", "Cancelar").
//
// As alturas são alvo de toque, não estética: 52 / 46 / 44, e o piso do
// sistema é 44px.

type CapsuleVariant = "principal" | "secundaria" | "tonal" | "texto";

const variantClasses: Record<CapsuleVariant, string> = {
  // Índigo cheio, texto 17/590, sombra da própria cor a 30%.
  principal: cn(
    "h-capsula-principal px-6 bg-indigo text-papel text-linha font-semibold shadow-capsula",
    "hover:bg-[hsl(226_57%_32%)] hover:shadow-capsula-hover",
    "active:translate-y-px active:shadow-capsula"
  ),
  // Branca com hairline, texto índigo.
  secundaria: cn(
    "h-capsula-secundaria px-5 bg-white text-indigo text-[16px] font-semibold shadow-capsula-secundaria",
    "hover:bg-papel"
  ),
  // Índigo a 12%. Texto sobre tonal fica na cor cheia.
  tonal: cn(
    "h-capsula-tonal px-5 bg-indigo/12 text-indigo text-[16px] font-semibold",
    "hover:bg-indigo/18"
  ),
  // Texto simples em índigo, para ação de saída.
  texto: "h-toque px-3 text-indigo text-[16px] font-semibold hover:bg-indigo/6",
};

export interface CapsuleProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: CapsuleVariant;
  loading?: boolean;
  /** Ocupa a largura do container — o padrão em tela de celular. */
  block?: boolean;
}

// Exportada para estilizar <Link> com a mesma aparência, sem aninhar <button>
// dentro de <a>. Mesmo padrão do buttonVariants em components/ui/button.tsx.
export function capsuleVariants(
  variant: CapsuleVariant = "principal",
  block = false,
  className?: string
) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-capsula tracking-[-0.43px]",
    // .18s no hover, .2s no toque — curto e nativo, sem bounce.
    "transition-all duration-180 ease-out active:scale-[0.98]",
    // O foco por teclado nunca é removido.
    "focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte",
    "disabled:pointer-events-none disabled:opacity-50",
    variantClasses[variant],
    block && "w-full",
    className
  );
}

export const Capsule = React.forwardRef<HTMLButtonElement, CapsuleProps>(
  (
    { className, variant = "principal", block = false, loading = false, disabled, children, ...props },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={capsuleVariants(variant, block, className)}
        {...props}
      >
        {loading && <Loader2 className="h-[18px] w-[18px] animate-spin" />}
        {children}
      </button>
    );
  }
);
Capsule.displayName = "Capsule";
