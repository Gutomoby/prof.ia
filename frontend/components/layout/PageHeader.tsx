"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useQuizGuard } from "./QuizGuardContext";

export interface Breadcrumb {
  label: string;
  href?: string;
}

export function PageHeader({
  title,
  backHref,
  backLabel = "Voltar",
  subtitle,
  action,
  topRight,
}: {
  title: string;
  backHref?: string;
  /** Rótulo do link de volta. O design nomeia o destino ("Prof. Atuária"). */
  backLabel?: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  /**
   * Canto superior direito, na mesma linha do link de volta. É onde o design
   * põe a engrenagem de ajustes (telas 16 e 21) — ícone solto, não cápsula:
   * a linha de cima é navegação, e uma cápsula ali competiria com a ação
   * principal da tela.
   */
  topRight?: React.ReactNode;
  /**
   * @deprecated O design trocou a trilha de migalhas pelo link de volta (celular)
   * e pela sidebar (desktop) — não é renderizada. A prop continua na assinatura
   * só para `professor/novo/page.tsx` seguir compilando até a Fase E; some
   * quando aquela tela migrar.
   */
  breadcrumb?: Breadcrumb[];
}) {
  const { unsaved } = useQuizGuard();

  function handleBackClick(e: React.MouseEvent) {
    if (unsaved && !window.confirm("Sair sem enviar? Suas respostas serão perdidas.")) {
      e.preventDefault();
    }
  }

  return (
    <div className="pb-4">
      {(backHref || topRight) && (
        <div className="mb-1 flex items-center justify-between gap-3">
          {backHref ? (
            <Link
              href={backHref}
              onClick={handleBackClick}
              className="-ml-1 inline-flex items-center gap-1.5 rounded-chip py-1 pl-1 pr-2 text-[16px] font-medium text-indigo transition-colors duration-140 ease-out hover:bg-indigo/6 focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte"
            >
              <ChevronLeft className="h-[18px] w-[18px]" />
              {backLabel}
            </Link>
          ) : (
            <span />
          )}
          {topRight}
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-x-5 gap-y-3">
        <div className="min-w-0">
          {/* Uma large title por tela, à esquerda. Tracking positivo, à moda SF. */}
          <h1 className="truncate text-titulo-grande text-tinta">{title}</h1>
          {subtitle && <div className="mt-1 text-corpo text-tinta-fraca">{subtitle}</div>}
        </div>
        {action && <div className="flex shrink-0 items-center gap-3">{action}</div>}
      </div>
    </div>
  );
}
