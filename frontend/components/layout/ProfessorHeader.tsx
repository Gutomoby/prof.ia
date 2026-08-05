"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Settings } from "lucide-react";
import { PageHeader } from "./PageHeader";
import { useQuizGuard } from "./QuizGuardContext";
import { useHeaderAction } from "./HeaderActionContext";
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
  // Quando a tela registra uma acao propria ("Salvar"), ela ocupa o canto no
  // lugar da engrenagem — o handoff nunca mostra os dois juntos.
  const acaoDaTela = useHeaderAction();

  const ativa = tabAtiva(pathname);
  const isHistoricoDetail = pathname.includes("/historico/");
  // A LISTA de tentativas (tela 24) é destino próprio, alcançado do Quiz — sem
  // barra na régua de seções, e voltando para o Quiz, não para a sala.
  const isHistoricoLista = /\/historico$/.test(pathname);
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

  // O large title é o nome da SEÇÃO, e o link de volta nomeia a matéria — é o
  // que o handoff faz (tela 16 "Material", tela 22 "Fazer um quiz"). Só a
  // visão geral leva o nome do professor, porque ali a seção é a própria sala
  // (tela 21).
  //
  // A Fase A tinha feito o inverso, com a matéria fixa no título; nas telas de
  // seção isso deixava o título repetindo o que o link de volta já dizia, e a
  // aba ativa como única pista de onde você está.
  const TITULOS: Record<string, string> = {
    progresso: "Progresso",
    quiz: "Fazer um quiz",
    material: "Material",
  };
  const emSecao = Boolean(ativa && ativa !== "geral");
  const naSecao = emSecao || isHistoricoDetail || isAjustes;
  const titulo = isHistoricoLista
    ? "Tentativas"
    : isHistoricoDetail
      ? "Revisão"
      : isAjustes
        ? "Ajustes"
        : emSecao
          ? TITULOS[ativa as string]
          : professor.name;

  return (
    <div className="mb-4">
      <PageHeader
        title={titulo}
        // Da seção o caminho de volta é a sala, não a home: é o que o link
        // "‹ ● Prof. Atuária" do handoff faz. Só a visão geral volta para
        // Estudar, porque dali a sala é o começo.
        backHref={
          isHistoricoLista
            ? `/professor/${professor.id}/quiz`
            : naSecao
              ? `/professor/${professor.id}`
              : "/dashboard"
        }
        backLabel={isHistoricoLista ? "Quiz" : naSecao ? professor.name : "Estudar"}
        // A disciplina só acompanha o título na visão geral. Nas seções o
        // título já é a seção, e cada tela põe o próprio subtítulo.
        subtitle={
          naSecao ? undefined : (
            <span className="flex items-center gap-2">
              {/* Cor de matéria sempre como ponto, nunca como fundo. */}
              <span aria-hidden className={cn("h-2 w-2 flex-none rounded-capsula", color.bg)} />
              {professor.discipline}
            </span>
          )
        }
        // Canto superior direito, na linha do link de volta — é onde o handoff
        // põe a engrenagem (telas 16 e 21). Antes era uma cápsula branca larga
        // no slot de ação, que no celular caía para baixo do subtítulo e
        // disputava atenção com a cápsula principal da tela.
        topRight={
          acaoDaTela ?? (isAjustes ? undefined : (
            <Link
              href={`/professor/${professor.id}/ajustes`}
              onClick={handleLinkClick}
              aria-label={`Ajustes de ${professor.name}`}
              title="Ajustes"
              className={cn(
                // 44px de alvo de toque, ícone de 20 — o piso do sistema vale
                // mesmo quando o desenho mostra só o glifo.
                "-mr-2 flex h-toque w-toque flex-none items-center justify-center rounded-capsula",
                "text-indigo transition-colors duration-140 ease-out hover:bg-indigo/6",
                "focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte"
              )}
            >
              <Settings className="h-5 w-5" />
            </Link>
          ))
        }
      />

      {ativa && !isAjustes && !isHistoricoDetail && !isHistoricoLista && (
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
