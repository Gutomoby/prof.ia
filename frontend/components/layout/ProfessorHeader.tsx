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
      {/* Em telas estreitas a disciplina vai para cima das abas e a régua de
          abas rola na horizontal — com 4 abas elas não cabem lado a lado com
          o rótulo em 360px. */}
      <div className="-mt-4 mb-6 flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
        <p className="text-sm text-muted-foreground">{professor.discipline}</p>
        <nav className="-mx-4 overflow-x-auto px-4 md:mx-0 md:ml-auto md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex w-max gap-1 rounded-full bg-muted p-1">
            {TABS.map((tab) => {
              const isActive = tab.match(pathname);
              return (
                <Link
                  key={tab.label}
                  href={tab.href(professor.id)}
                  onClick={handleTabClick}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isActive ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
