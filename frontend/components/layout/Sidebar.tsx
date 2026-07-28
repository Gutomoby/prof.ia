"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
      <Link href="/dashboard" className="text-xl font-bold">
        🎓 ProfessorIA
      </Link>

      <nav className="mt-6 flex-1 space-y-1">
        {professors.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum professor ainda.</p>
        )}
        {professors.map((p) => (
          <Link
            key={p.id}
            href={`/professor/${p.id}/quiz`}
            className={cn(
              "block rounded-md px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground",
              pathname.startsWith(`/professor/${p.id}`) && "bg-accent text-accent-foreground"
            )}
          >
            <span className="font-medium">{p.name}</span>
            <span className="block text-xs text-muted-foreground">{p.discipline}</span>
          </Link>
        ))}
        <Link
          href="/professor/novo"
          className="mt-2 block rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          + Novo professor
        </Link>
      </nav>

      <button
        onClick={handleLogout}
        className="mt-4 rounded-md px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      >
        Sair
      </button>
    </aside>
  );
}
