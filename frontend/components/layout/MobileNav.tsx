"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CalendarDays, GraduationCap, Home, Library, LogOut, Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useQuizGuard } from "./QuizGuardContext";
import { cn } from "@/lib/utils";
import { professorColor } from "@/lib/professor-color";
import type { ProfessorListItem } from "@/lib/types";

const TABS = [
  { href: "/dashboard", label: "Início", icon: Home },
  { href: "/calendario", label: "Calendário", icon: CalendarDays },
  { href: "/biblioteca", label: "Biblioteca", icon: Library },
];

/**
 * Navegação de celular. A Sidebar é `hidden md:flex`, então abaixo de 768px o
 * app ficava literalmente sem navegação: só dava pra voltar pelo botão do
 * navegador. Aqui a barra fixa cobre as três rotas globais e o quarto item
 * abre a lista de matérias numa gaveta.
 */
export function MobileNav({ professors }: { professors: ProfessorListItem[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const { unsaved } = useQuizGuard();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Fecha a gaveta ao trocar de rota — senão ela fica aberta por cima da tela nova.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Trava o scroll do fundo enquanto a gaveta está aberta.
  useEffect(() => {
    if (!drawerOpen) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = anterior;
    };
  }, [drawerOpen]);

  useEffect(() => {
    if (!drawerOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDrawerOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  function confirmNavigate(): boolean {
    if (!unsaved) return true;
    return window.confirm("Sair sem enviar? Suas respostas serão perdidas.");
  }

  function handleLinkClick(e: React.MouseEvent) {
    if (!confirmNavigate()) e.preventDefault();
  }

  async function handleLogout() {
    if (!confirmNavigate()) return;
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const emProfessor = pathname.startsWith("/professor");

  return (
    <>
      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-foreground/40"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Suas matérias"
            className="absolute inset-x-0 bottom-0 max-h-[75vh] overflow-y-auto rounded-t-2xl border-t bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-lg"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Suas matérias
              </h2>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Fechar"
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="space-y-1">
              {professors.length === 0 && (
                <p className="px-3 py-2 text-sm text-muted-foreground">Nenhum professor ainda.</p>
              )}
              {professors.map((p) => (
                <Link
                  key={p.id}
                  href={`/professor/${p.id}`}
                  onClick={handleLinkClick}
                  className={cn(
                    "block rounded-lg px-3 py-2.5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    pathname.startsWith(`/professor/${p.id}`) && "bg-primary/10"
                  )}
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <span className={cn("inline-block h-2 w-2 shrink-0 rounded-full", professorColor(p.id).bg)} />
                    {p.name}
                  </span>
                  <span className="ml-4 block text-xs text-muted-foreground">{p.discipline}</span>
                </Link>
              ))}

              <Link
                href="/professor/novo"
                onClick={handleLinkClick}
                className="mt-2 flex items-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Plus className="h-4 w-4" />
                Novo professor
              </Link>

              <button
                onClick={handleLogout}
                className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </button>
            </nav>
          </div>
        </div>
      )}

      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              onClick={handleLinkClick}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              {tab.label}
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-expanded={drawerOpen}
          aria-haspopup="dialog"
          className={cn(
            "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
            emProfessor ? "text-primary" : "text-muted-foreground"
          )}
        >
          <GraduationCap className="h-5 w-5" />
          Matérias
        </button>
      </nav>
    </>
  );
}
