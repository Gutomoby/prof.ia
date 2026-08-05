"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CalendarDays, Flame, Library, Plus, Settings, Target, Trophy } from "lucide-react";
import { api } from "@/lib/api";
import { createClient } from "@/lib/supabase";
import { Brand } from "./Brand";
import { useQuizGuard } from "./QuizGuardContext";
import { cn } from "@/lib/utils";
import { professorColor } from "@/lib/professor-color";
import { MetricText } from "@/components/ui/metric-text";
import { ProgressBar } from "@/components/ui/gauge";
import type { ProfessorListItem, UserProgress } from "@/lib/types";

/*
  Sidebar do desktop — 280px em vidro, substitui a barra de abas.

  Não é a barra de abas na vertical: as matérias são a navegação principal
  aqui, e "Estudar" não vira item porque a sidebar já mostra o conteúdo dele.

  A busca ⌘K do design continua de fora, por não ter endpoint nem tela.
  Chrome que não faz nada é pior que chrome ausente. "Conquistas" entrou
  quando a tela 34 passou a existir.
*/

// Iniciais da matéria para o avatar: "Prof. Atuária" -> "At". Pula o "Prof."
// porque senão toda matéria vira "Pr".
function iniciais(nome: string): string {
  const limpo = nome.replace(/^prof(\.|essor|essora)?\s*/i, "").trim();
  const palavras = limpo.split(/\s+/).filter(Boolean);
  if (palavras.length === 0) return nome.slice(0, 2);
  if (palavras.length === 1) return palavras[0].slice(0, 2);
  return (palavras[0][0] + palavras[1][0]).toUpperCase();
}

function SecaoLabel({ children, contagem }: { children: React.ReactNode; contagem?: number }) {
  return (
    <p className="mb-2 flex items-baseline justify-between pl-4 pr-3.5 text-rotulo uppercase text-tinta-fraca">
      <span>{children}</span>
      {contagem !== undefined && (
        <MetricText tone="fraca" className="text-[11.5px] normal-case tracking-normal">
          {contagem}
        </MetricText>
      )}
    </p>
  );
}

export function Sidebar({ professors }: { professors: ProfessorListItem[] }) {
  const pathname = usePathname();
  const { unsaved } = useQuizGuard();
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  // Sequência e nível ficam sempre visíveis — é o que faz sentir que há algo
  // em jogo ao fechar o app.
  useEffect(() => {
    api
      .getProgress()
      .then(setProgress)
      .catch(() => setProgress(null));
  }, [pathname]);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null))
      .catch(() => setEmail(null));
  }, []);

  function handleLinkClick(e: React.MouseEvent) {
    if (unsaved && !window.confirm("Sair sem enviar? Suas respostas serão perdidas.")) {
      e.preventDefault();
    }
  }

  const itemBase =
    "flex items-center gap-3 rounded-chip px-3 transition-colors duration-140 ease-out focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte";

  return (
    <aside className="vidro-sidebar relative hidden w-[280px] flex-none flex-col gap-[18px] border-r-[0.5px] border-borda px-3 pb-4 pt-[22px] md:flex">
      <div className="flex items-center px-3">
        <Link
          href="/dashboard"
          onClick={handleLinkClick}
          className="rounded-chip focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte"
        >
          <Brand icone />
        </Link>
      </div>

      {/* HUD: sequência, nível e meta do dia. */}
      {progress && (
        <div className="vidro-cartao mx-1 rounded-cartao px-4 py-3.5 shadow-vidro">
          <div className="flex items-center gap-3.5">
            <span className="flex items-center gap-1.5">
              <Flame
                className={cn(
                  "h-[17px] w-[17px]",
                  progress.current_streak > 0 ? "text-acerto" : "text-tinta-fraca"
                )}
              />
              <MetricText weight="bold" className="text-[17px]">
                {progress.current_streak}
              </MetricText>
            </span>
            <span className="h-6 w-[0.5px] bg-borda" />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold tracking-[-0.24px]">
                Nível <MetricText>{progress.level}</MetricText>
              </p>
              <ProgressBar
                className="mt-1.5 h-[5px]"
                value={(progress.xp_no_nivel / progress.xp_do_nivel) * 100}
                aria-label={`${progress.xp_no_nivel} de ${progress.xp_do_nivel} XP no nível`}
              />
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 border-t-[0.5px] border-borda pt-3">
            <Target className="h-[15px] w-[15px] text-acerto" />
            {/* A meta do design é em lições; a API só entrega XP hoje.
                Vira "1/2 lições" quando o backend expuser a contagem (Fase B). */}
            <span className="flex-1 text-nota text-tinta-fraca">Meta de hoje</span>
            <span className="text-nota">
              <MetricText weight="bold">
                {progress.xp_hoje}/{progress.daily_goal_xp}
              </MetricText>
              <span className="ml-1 text-tinta-fraca">XP</span>
            </span>
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto">
        <div>
          <SecaoLabel contagem={professors.length}>Matérias</SecaoLabel>
          {professors.length === 0 && (
            <p className="px-3 text-nota text-tinta-fraca">Nenhuma matéria ainda.</p>
          )}
          {professors.map((p) => {
            const isActive = pathname.startsWith(`/professor/${p.id}`);
            const color = professorColor(p.id);
            return (
              <Link
                key={p.id}
                href={`/professor/${p.id}`}
                onClick={handleLinkClick}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  itemBase,
                  "min-h-[58px]",
                  isActive ? "bg-indigo/10" : "hover:bg-indigo/5"
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex h-[34px] w-[34px] flex-none items-center justify-center rounded-icone text-[15px] font-bold",
                    color.soft,
                    color.text
                  )}
                >
                  {iniciais(p.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block truncate text-[16px] tracking-[-0.43px]",
                      isActive ? "font-semibold text-indigo" : "text-tinta"
                    )}
                  >
                    {p.name}
                  </span>
                  <span className="block truncate text-[12.5px] text-tinta-fraca">{p.discipline}</span>
                </span>
              </Link>
            );
          })}

          <Link
            href="/professor/novo"
            onClick={handleLinkClick}
            className={cn(itemBase, "min-h-toque text-indigo hover:bg-indigo/5")}
          >
            <Plus className="h-[18px] w-[18px] flex-none" />
            <span className="flex-1 text-[16px] font-medium tracking-[-0.43px]">Nova matéria</span>
          </Link>
        </div>

        <div>
          <SecaoLabel>Geral</SecaoLabel>
          {[
            { href: "/biblioteca", label: "Biblioteca", icon: Library },
            { href: "/calendario", label: "Calendário", icon: CalendarDays },
            { href: "/perfil/conquistas", label: "Conquistas", icon: Trophy },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleLinkClick}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  itemBase,
                  "min-h-12",
                  isActive ? "bg-indigo/10" : "hover:bg-indigo/5"
                )}
              >
                <Icon
                  className={cn("h-[19px] w-[19px] flex-none", isActive ? "text-indigo" : "text-tinta-fraca")}
                />
                <span
                  className={cn(
                    "flex-1 text-[16px] tracking-[-0.43px]",
                    isActive ? "font-semibold text-indigo" : "text-tinta"
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Rodapé: a conta. "Sair" e configurações moram em /perfil. */}
      <Link
        href="/perfil"
        onClick={handleLinkClick}
        className={cn(
          // Raio 18: não está na escala do guia (26/22/20/16/14/12), mas é o
          // valor da tela 52. Telas mandam.
          "mx-1 flex items-center gap-3 rounded-[18px] bg-white/72 px-3 py-2.5 shadow-hairline",
          "transition-colors duration-140 ease-out hover:bg-white",
          "focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte"
        )}
      >
        {/* Kango é placeholder até a persona 3D existir: círculo listrado a 135°. */}
        <span
          aria-hidden
          className="h-[38px] w-[38px] flex-none rounded-capsula shadow-[inset_0_0_0_1px_rgba(255,255,255,.9)]"
          style={{
            background:
              "repeating-linear-gradient(135deg, rgba(67,56,202,.2) 0 6px, rgba(255,255,255,.8) 6px 12px)",
          }}
        />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold tracking-[-0.24px]">Perfil</span>
          <span className="block truncate text-[12.5px] text-tinta-fraca">{email ?? "—"}</span>
        </span>
        <Settings className="h-[17px] w-[17px] flex-none text-tinta-fraca" />
      </Link>
    </aside>
  );
}
