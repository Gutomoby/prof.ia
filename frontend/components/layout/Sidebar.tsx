"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useQuizGuard } from "./QuizGuardContext";
import { cn } from "@/lib/utils";
import type { ProfessorListItem } from "@/lib/types";

export function Sidebar({ professors }: { professors: ProfessorListItem[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const { unsaved } = useQuizGuard();

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
      <Link href="/dashboard" onClick={handleLinkClick} className="px-1 text-xl font-bold">
        🎓 ProfessorIA
      </Link>

      <nav className="mt-6 flex-1 space-y-1">
        {professors.length === 0 && (
          <p className="px-3 text-sm text-muted-foreground">Nenhum professor ainda.</p>
        )}
        {professors.map((p) => {
          const isActive = pathname.startsWith(`/professor/${p.id}`);
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
              <span className="font-medium">{p.name}</span>
              <span className="block text-xs text-muted-foreground">{p.discipline}</span>
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
      </nav>

      <button
        onClick={handleLogout}
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <LogOut className="h-4 w-4" />
        Sair
      </button>
    </aside>
  );
}
