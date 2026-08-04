"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
import { GlassCard } from "@/components/ui/glass-card";
import { MetricText } from "@/components/ui/metric-text";
import { Skeleton } from "@/components/ui/skeleton";
import { professorColor } from "@/lib/professor-color";
import { cn, localDateKey } from "@/lib/utils";
import type { CalendarResponse } from "@/lib/types";

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/*
  Versão compacta do calendário para a tela Estudar: só o mês atual, dias com
  bolinha colorida por matéria estudada e traço nos dias com evento marcado.
  Clique leva para /calendario, onde mora a visão completa.
*/
export function MiniCalendar() {
  const [data, setData] = useState<CalendarResponse | null>(null);
  const [failed, setFailed] = useState(false);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const todayKey = `${year}-${pad(month + 1)}-${pad(now.getDate())}`;

  useEffect(() => {
    const inicio = `${year}-${pad(month + 1)}-01`;
    const fim = `${year}-${pad(month + 1)}-${pad(new Date(year, month + 1, 0).getDate())}`;
    api
      .getCalendar(inicio, fim)
      .then(setData)
      .catch(() => setFailed(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sem dado não há o que mostrar — a tela fica mais limpa sem um cartão de erro.
  if (failed) return null;

  if (!data) {
    return <Skeleton className="h-full min-h-[16rem] rounded-grupo" />;
  }

  const materiasByDay: Record<string, string[]> = {};
  for (const a of data.activities) {
    const key = localDateKey(a.created_at);
    const list = (materiasByDay[key] ??= []);
    if (!list.includes(a.professor_id)) list.push(a.professor_id);
  }
  const eventDays = new Set(data.events.map((e) => e.event_date));

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = new Date(year, month, 1).getDay();
  const monthLabel = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <GlassCard nivel="cartao" radius="grupo" className="flex h-full flex-col p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <p className="text-linha font-semibold capitalize text-tinta">{monthLabel}</p>
        <Link
          href="/calendario"
          className="-mr-1 inline-flex items-center gap-0.5 rounded-chip py-1 pl-2 pr-1 text-nota font-semibold text-indigo transition-colors duration-140 ease-out hover:bg-indigo/6 focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte"
        >
          Ver calendário
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-7 gap-y-1.5 text-center">
        {WEEKDAYS.map((w, i) => (
          <span key={i} className="text-rotulo uppercase text-tinta-fraca">
            {w}
          </span>
        ))}
        {Array.from({ length: leading }).map((_, i) => (
          <span key={`pad-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const key = `${year}-${pad(month + 1)}-${pad(day)}`;
          const materias = materiasByDay[key] ?? [];
          const isToday = key === todayKey;
          return (
            <span key={key} className="flex flex-col items-center gap-0.5">
              <MetricText
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-nota",
                  isToday && "bg-indigo text-papel"
                )}
                tone={isToday ? "tinta" : "fraca"}
                weight={isToday ? "bold" : "normal"}
              >
                {day}
              </MetricText>
              <span className="flex h-1.5 items-center gap-0.5">
                {materias.slice(0, 3).map((pid) => (
                  <span key={pid} className={cn("h-1.5 w-1.5 rounded-full", professorColor(pid).bg)} />
                ))}
                {materias.length === 0 && eventDays.has(key) && (
                  <span className="h-1 w-3 rounded-full bg-tinta-fraca/60" />
                )}
              </span>
            </span>
          );
        })}
      </div>
    </GlassCard>
  );
}
