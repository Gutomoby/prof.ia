"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Settings } from "lucide-react";
import { PageHeader } from "./PageHeader";
import { useQuizGuard } from "./QuizGuardContext";
import { Segmented } from "@/components/ui/segmented";
import { professorColor } from "@/lib/professor-color";
import { cn } from "@/lib/utils";

const TABS = [
  { value: "geral", label: "Visão geral", path: (id: string) => `/professor/${id}` },
  { value: "progresso", label: "Progresso", path: (id: string) => `/professor/${id}/inicio` },
  { value: "quiz", label: "Quiz", path: (id: string) => `/professor/${id}/quiz` },
  { value: "material", label: "Material", path: (id: string) => `/professor/${id}/configurar` },
] as const;

type TabValue = (typeof TABS)[number]["value"];

function tabAtiva(pathname: string): TabValue | null {
  if (pathname.includes("/inicio")) return "progresso";
  if (pathname.includes("/quiz")) return "quiz";
  if (pathname.includes("/configurar")) return "material";
  if (/^\/professor\/[^/]+$/.test(pathname)) return "geral";
  return null;
}

export function ProfessorHeader({
  professor,
}: {
  professor: { id: string; name: string; discipline: string };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { unsaved } = useQuizGuard();

  const ativa = tabAtiva(pathname);
  const isHistoricoDetail = pathname.includes("/historico/");
  // Ajustes não vira aba: com 4 abas a régua já fica no limite em 360px.
  const isAjustes = pathname.includes("/ajustes");
  const color = professorColor(professor.id);

  function confirmNavigate(): boolean {
    if (!unsaved) return true;
    return window.confirm("Sair sem enviar? Suas respostas serão perdidas.");
  }

  function handleTabChange(value: string) {
    if (!confirmNavigate()) return;
    const tab = TABS.find((t) => t.value === value);
    if (tab) router.push(tab.path(professor.id));
  }

  function handleLinkClick(e: React.MouseEvent) {
    if (!confirmNavigate()) e.preventDefault();
  }

  // O nome da matéria é o título: as abas dizem em que seção você está, o
  // large title diz de quem é a sala. Revisão e Ajustes saem desse padrão
  // porque são destinos, não seções.
  const titulo = isHistoricoDetail ? "Revisão" : isAjustes ? "Ajustes" : professor.name;

  return (
    <div className="mb-4">
      <PageHeader
        title={titulo}
        backHref={
          isHistoricoDetail || isAjustes ? `/professor/${professor.id}` : "/dashboard"
        }
        backLabel={isHistoricoDetail || isAjustes ? professor.name : "Estudar"}
        subtitle={
          <span className="flex items-center gap-2">
            {/* Cor de matéria sempre como ponto, nunca como fundo. */}
            <span aria-hidden className={cn("h-2 w-2 flex-none rounded-capsula", color.bg)} />
            {professor.discipline}
          </span>
        }
        action={
          isAjustes ? undefined : (
            <Link
              href={`/professor/${professor.id}/ajustes`}
              onClick={handleLinkClick}
              aria-label={`Ajustes de ${professor.name}`}
              className={cn(
                "flex h-capsula-secundaria items-center gap-2 rounded-capsula bg-white px-5",
                "text-[16px] font-semibold text-indigo shadow-capsula-secundaria",
                "transition-all duration-180 ease-out hover:bg-papel",
                "focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte"
              )}
            >
              <Settings className="h-[17px] w-[17px]" />
              Ajustes
            </Link>
          )
        }
      />

      {ativa && !isAjustes && !isHistoricoDetail && (
        <div className="md:max-w-[560px]">
          <Segmented
            aria-label={`Seções de ${professor.name}`}
            value={ativa}
            onValueChange={handleTabChange}
            options={TABS.map((t) => ({ value: t.value, label: t.label }))}
            size="mobile"
            className="md:hidden"
          />
          <Segmented
            aria-label={`Seções de ${professor.name}`}
            value={ativa}
            onValueChange={handleTabChange}
            options={TABS.map((t) => ({ value: t.value, label: t.label }))}
            size="desktop"
            className="hidden md:flex"
          />
        </div>
      )}
    </div>
  );
}
