"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PageHeader } from "./PageHeader";
import { useQuizGuard } from "./QuizGuardContext";
import { cn } from "@/lib/utils";

const TABS = [
  { href: (id: string) => `/professor/${id}`, label: "Visão geral", match: (p: string) => /^\/professor\/[^/]+$/.test(p) },
  { href: (id: string) => `/professor/${id}/inicio`, label: "Progresso", match: (p: string) => p.includes("/inicio") },
  { href: (id: string) => `/professor/${id}/quiz`, label: "Quiz", match: (p: string) => p.includes("/quiz") },
  { href: (id: string) => `/professor/${id}/configurar`, label: "Material", match: (p: string) => p.includes("/configurar") },
];

export function ProfessorHeader({
  professor,
}: {
  professor: { id: string; name: string; discipline: string };
}) {
  const pathname = usePathname();
  const activeTab = TABS.find((t) => t.match(pathname));
  const isHistoricoDetail = pathname.includes("/historico/");
  const { unsaved } = useQuizGuard();

  function handleTabClick(e: React.MouseEvent) {
    if (unsaved && !window.confirm("Sair sem enviar? Suas respostas serão perdidas.")) {
      e.preventDefault();
    }
  }

  return (
    <div>
      <PageHeader
        title={isHistoricoDetail ? "Revisão" : activeTab?.label ?? professor.name}
        backHref={isHistoricoDetail ? `/professor/${professor.id}/quiz` : "/dashboard"}
        breadcrumb={[
          { label: "Professores", href: "/dashboard" },
          { label: professor.name, href: `/professor/${professor.id}` },
          ...(activeTab ? [{ label: activeTab.label, href: isHistoricoDetail ? activeTab.href(professor.id) : undefined }] : []),
          ...(isHistoricoDetail ? [{ label: "Revisão" }] : []),
        ]}
      />
      <div className="-mt-4 mb-6 flex items-center gap-4">
        <p className="text-sm text-muted-foreground">{professor.discipline}</p>
        <nav className="ml-auto flex gap-1 rounded-full bg-muted p-1">
          {TABS.map((tab) => {
            const isActive = tab.match(pathname);
            return (
              <Link
                key={tab.label}
                href={tab.href(professor.id)}
                onClick={handleTabClick}
                className={cn(
                  "rounded-full px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
