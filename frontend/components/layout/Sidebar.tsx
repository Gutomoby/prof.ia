"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CalendarDays, Flame, Home, Library, LogOut, Plus, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { api } from "@/lib/api";
import { Brand } from "./Brand";
import { useQuizGuard } from "./QuizGuardContext";
import { cn } from "@/lib/utils";
import { professorColor } from "@/lib/professor-color";
import type { ProfessorListItem, UserProgress } from "@/lib/types";

const NAV = [
  { href: "/dashboard", label: "Início", icon: Home },
  { href: "/calendario", label: "Calendário", icon: CalendarDays },
  { href: "/biblioteca", label: "Biblioteca", icon: Library },
];

export function Sidebar({ professors }: { professors: ProfessorListItem[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const { unsaved } = useQuizGuard();
  const [progress, setProgress] = useState<UserProgress | null>(null);

  // Sequência e nível ficam sempre visíveis — é o que faz o usuário sentir que
  // há algo em jogo ao fechar o app.
  useEffect(() => {
    api
      .getProgress()
      .then(setProgress)
      .catch(() => setProgress(null));
  }, [pathname]);

  // true = pode navegar/deslogar. Só interrompe (com confirm) se houver um
  // quiz em andamento sem enviar — mesma regra do PageHeader/ProfessorHeader.
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

  return (
    <aside className="hidden w-64 flex-col border-r bg-muted/40 p-4 md:flex">
      <Link href="/dashboard" onClick={handleLinkClick} className="px-1">
        <Brand className="text-xl" />
      </Link>

      <nav className="mt-6 space-y-1">
        {NAV.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleLinkClick}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive && "bg-primary/10 font-medium hover:bg-primary/10"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 flex-1 space-y-1 overflow-y-auto">
        <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Seus professores
        </p>
        {professors.length === 0 && (
          <p className="px-3 text-sm text-muted-foreground">Nenhum professor ainda.</p>
        )}
        {professors.map((p) => {
          const isActive = pathname.startsWith(`/professor/${p.id}`);
          const color = professorColor(p.id);
          return (
            <Link
              key={p.id}
              href={`/professor/${p.id}`}
              onClick={handleLinkClick}
              className={cn(
                "block rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive && "bg-primary/10 hover:bg-primary/10"
              )}
            >
              <span className="flex items-center gap-2">
                <span className={cn("inline-block h-2 w-2 shrink-0 rounded-full", color.bg)} />
                <span className="truncate font-medium">{p.name}</span>
              </span>
              <span className="ml-4 block truncate text-xs text-muted-foreground">{p.discipline}</span>
            </Link>
          );
        })}
        <Link
          href="/professor/novo"
          onClick={handleLinkClick}
          className="mt-2 flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus className="h-4 w-4" />
          Novo professor
        </Link>
      </div>

      {progress && (
        <div className="mt-4 space-y-2 border-t pt-4">
          <div className="flex items-center gap-2 px-3 text-sm">
            <Flame
              className={cn("h-4 w-4", progress.current_streak > 0 ? "text-success" : "text-muted-foreground")}
            />
            <span className="metric">
              {progress.current_streak} {progress.current_streak === 1 ? "dia" : "dias"}
            </span>
          </div>
          <div className="px-3">
            <div className="flex items-center gap-2 text-sm">
              <Zap className="h-4 w-4 text-primary" />
              <span>Nível {progress.level}</span>
              <span className="ml-auto text-xs metric text-muted-foreground">
                {progress.xp_no_nivel}/{progress.xp_do_nivel}
              </span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.round((progress.xp_no_nivel / progress.xp_do_nivel) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      <button
        onClick={handleLogout}
        className="mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <LogOut className="h-4 w-4" />
        Sair
      </button>
    </aside>
  );
}
