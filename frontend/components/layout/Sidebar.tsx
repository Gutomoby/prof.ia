"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type { ProfessorListItem } from "@/lib/types";

export function Sidebar({ professors }: { professors: ProfessorListItem[] }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="hidden w-64 flex-col border-r bg-muted/40 p-4 md:flex">
      <Link href="/dashboard" className="px-1 text-xl font-bold">
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
              href={`/professor/${p.id}/quiz`}
              className={cn(
                "block rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                isActive && "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary"
              )}
            >
              <span className="font-medium">{p.name}</span>
              <span className={cn("block text-xs", isActive ? "text-primary/70" : "text-muted-foreground")}>
                {p.discipline}
              </span>
            </Link>
          );
        })}
        <Link
          href="/professor/novo"
          className="mt-2 flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <Plus className="h-4 w-4" />
          Novo professor
        </Link>
      </nav>

      <button
        onClick={handleLogout}
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        <LogOut className="h-4 w-4" />
        Sair
      </button>
    </aside>
  );
}
