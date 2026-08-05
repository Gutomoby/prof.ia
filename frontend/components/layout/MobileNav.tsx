"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { CalendarDays, GraduationCap, Library, User } from "lucide-react";
import { useQuizGuard } from "./QuizGuardContext";
import { cn } from "@/lib/utils";

/*
  Barra de abas do celular, flutuando em vidro sobre o conteúdo.

  Quatro itens fixos, como no design: Estudar · Biblioteca · Calendário · Perfil.
  A gaveta de matérias saiu — as matérias são o conteúdo de "Estudar", não um
  quinto item de navegação. "Sair" também saiu daqui: mora em /perfil, que é o
  lugar dele no design.
*/
const TABS = [
  { href: "/dashboard", label: "Estudar", icon: GraduationCap },
  { href: "/biblioteca", label: "Biblioteca", icon: Library },
  { href: "/calendario", label: "Calendário", icon: CalendarDays },
  { href: "/perfil", label: "Perfil", icon: User },
];

export function MobileNav() {
  const pathname = usePathname();
  const { unsaved } = useQuizGuard();

  /*
    Some enquanto o teclado está aberto.

    A barra é `position: fixed`, e no iOS o fixed se prende à viewport de
    LAYOUT, que não encolhe com o teclado. Resultado: ela fica pairando no meio
    do conteúdo, cobrindo justamente o campo que a pessoa foi preencher.

    `interactiveWidget: resizes-content` (no viewport do layout raiz) resolve a
    geometria nos navegadores que o suportam; esconder a barra resolve em todos
    e ainda devolve espaço de tela — que é o que a pessoa quer enquanto digita.
  */
  const [digitando, setDigitando] = useState(false);

  useEffect(() => {
    const ehCampo = (el: EventTarget | null) =>
      el instanceof HTMLElement &&
      (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);

    const aoFocar = (e: FocusEvent) => ehCampo(e.target) && setDigitando(true);
    const aoDesfocar = () => setDigitando(false);

    document.addEventListener("focusin", aoFocar);
    document.addEventListener("focusout", aoDesfocar);
    return () => {
      document.removeEventListener("focusin", aoFocar);
      document.removeEventListener("focusout", aoDesfocar);
    };
  }, []);

  function handleLinkClick(e: React.MouseEvent) {
    if (unsaved && !window.confirm("Sair sem enviar? Suas respostas serão perdidas.")) {
      e.preventDefault();
    }
  }

  return (
    <nav
      aria-label="Navegação principal"
      // Flutua sobre o conteúdo: 16px de margem lateral e a área segura embaixo.
      className={cn(
        "vidro-abas shadow-vidro-flutuante",
        "fixed inset-x-4 bottom-[max(12px,env(safe-area-inset-bottom))] z-30",
        "flex h-16 items-center rounded-capsula px-1.5 md:hidden",
        // Sem display:none: `hidden` mataria a transição e a barra voltaria
        // piscando quando o campo perde o foco.
        "transition-opacity duration-180 ease-out",
        digitando && "pointer-events-none opacity-0"
      )}
      aria-hidden={digitando}
    >
      {TABS.map((tab) => {
        const Icon = tab.icon;
        // "Estudar" é a raiz: só casa exato, senão fica ativa em todo lugar.
        // /professor/* é conteúdo de Estudar, então também acende ali.
        const isActive =
          tab.href === "/dashboard"
            ? pathname === "/dashboard" || pathname === "/materias" || pathname.startsWith("/professor")
            : pathname.startsWith(tab.href);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            onClick={handleLinkClick}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex h-linha flex-1 flex-col items-center justify-center gap-0.5 rounded-capsula",
              "transition-colors duration-140 ease-out",
              "focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte",
              isActive ? "bg-indigo/12 text-indigo" : "text-tinta-fraca"
            )}
          >
            <Icon className="h-[22px] w-[22px]" strokeWidth={2} />
            <span className={cn("text-[10px]", isActive ? "font-semibold" : "font-medium")}>
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
