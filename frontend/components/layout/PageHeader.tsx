"use client";

import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useQuizGuard } from "./QuizGuardContext";
import { cn } from "@/lib/utils";

export interface Breadcrumb {
  label: string;
  href?: string;
}

export function PageHeader({
  title,
  backHref,
  breadcrumb,
  action,
}: {
  title: string;
  backHref?: string;
  breadcrumb?: Breadcrumb[];
  action?: React.ReactNode;
}) {
  const { unsaved } = useQuizGuard();

  function handleBackClick(e: React.MouseEvent) {
    if (unsaved && !window.confirm("Sair sem enviar? Suas respostas serão perdidas.")) {
      e.preventDefault();
    }
  }

  return (
    <div className="space-y-3 pb-6">
      {breadcrumb && breadcrumb.length > 0 && (
        <nav className="flex items-center gap-1 overflow-x-auto text-sm text-muted-foreground">
          {breadcrumb.map((crumb, i) => (
            <span key={i} className="flex shrink-0 items-center gap-1">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  onClick={handleBackClick}
                  className="rounded-sm underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-foreground">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 items-center gap-3">
          {backHref && (
            <Link
              href={backHref}
              onClick={handleBackClick}
              className={cn(buttonVariants("secondary", "sm"), "px-2.5 sm:px-3")}
              aria-label="Voltar"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Voltar</span>
            </Link>
          )}
          <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl md:text-3xl">{title}</h1>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}
