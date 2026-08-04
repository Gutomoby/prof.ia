"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/*
  Grupo de campos das telas de conta. É a inset grouped list com <input> de
  verdade no lugar do valor — mesma régua de 56px, mesmo separador de 0,5px
  entrando a 16px (não há ícone nestas linhas), mesmo raio de grupo.

  Muda com a largura, como no design:
    celular   vidro .86, raio 26, rótulo de 86px
    desktop   #fff com hairline, raio 20, rótulo de 78px
*/

export function FieldGroup({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-grupo",
        // Sem separador na última linha — regra no grupo, ver InsetList.
        "[&>*:last-child_[data-sep]]:hidden",
        "vidro-cartao shadow-[inset_1.5px_1.5px_1px_rgba(255,255,255,.95),0_10px_30px_rgba(20,20,30,.08)]",
        "md:rounded-alerta md:bg-white md:shadow-hairline md:backdrop-blur-none md:backdrop-saturate-100",
        className
      )}
    >
      {children}
    </div>
  );
}

export interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Acessório à direita: "Mostrar", ícone de estado. */
  trailing?: React.ReactNode;
  /** Pinta a linha inteira de vermelho tonal (tela 03). */
  erro?: boolean;
}

export const Field = React.forwardRef<HTMLInputElement, FieldProps>(
  ({ label, trailing, erro = false, className, id, ...props }, ref) => {
    const auto = React.useId();
    const fieldId = id ?? auto;

    return (
      <div
        className={cn(
          "relative flex min-h-linha-campo items-center gap-3 px-4",
          erro && "bg-erro/[0.07]",
          className
        )}
      >
        <label
          htmlFor={fieldId}
          className={cn(
            "w-[86px] flex-none text-linha md:w-[78px]",
            erro ? "text-erro" : "text-tinta-fraca"
          )}
        >
          {label}
        </label>
        <input
          ref={ref}
          id={fieldId}
          className={cn(
            "min-w-0 flex-1 bg-transparent text-linha font-medium outline-none",
            "placeholder:font-normal placeholder:text-[hsl(60_6%_72%)]",
            // A senha vira mono com o tracking dos pontinhos do design.
            props.type === "password" && "font-mono tracking-[0.14em]",
            erro && "text-erro"
          )}
          {...props}
        />
        {trailing && <span className="flex-none">{trailing}</span>}
        <span aria-hidden data-sep className="absolute bottom-0 left-4 right-0 h-[0.5px] bg-borda" />
      </div>
    );
  }
);
Field.displayName = "Field";

/** "Mostrar" / "Ocultar" da linha de senha: 15/510 em índigo. */
export function ToggleSenha({ visivel, onToggle }: { visivel: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="rounded-chip px-1 py-1 text-corpo font-medium text-indigo focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte"
    >
      {visivel ? "Ocultar" : "Mostrar"}
    </button>
  );
}

/** Régua "ou" entre o formulário e os provedores sociais. */
export function Divisor() {
  return (
    <div className="flex items-center gap-3">
      <span className="h-[0.5px] flex-1 bg-borda" />
      <span className="text-nota text-tinta-fraca">ou</span>
      <span className="h-[0.5px] flex-1 bg-borda" />
    </div>
  );
}
