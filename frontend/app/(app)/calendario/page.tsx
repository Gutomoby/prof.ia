"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Capsule } from "@/components/ui/capsule";
import { GlassCard } from "@/components/ui/glass-card";
import { InlineAlert } from "@/components/ui/inline-alert";
import { MetricText } from "@/components/ui/metric-text";
import { Skeleton } from "@/components/ui/skeleton";
import { MonthGrid, dateKey } from "@/components/calendario/MonthGrid";
import { DayPanel } from "@/components/calendario/DayPanel";
import { professorColor } from "@/lib/professor-color";
import { cn, localDateKey } from "@/lib/utils";
import type {
  CalendarActivity,
  CalendarEvent,
  EventKind,
  ProfessorListItem,
} from "@/lib/types";

/*
  Tela 32 · Calendário.

  O subtítulo conta o mês inteiro ("2 provas e 6 revisões em agosto"), não o dia
  selecionado — é o resumo que responde "vale abrir esta tela?" antes de
  qualquer clique.

  A legenda existe porque a grade só mostra pontos coloridos: sem ela, a cor
  não significa nada para quem tem três matérias.
*/

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export default function CalendarioPage() {
  const hoje = useMemo(() => new Date(), []);
  const todayKey = dateKey(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

  const [year, setYear] = useState(hoje.getFullYear());
  const [month, setMonth] = useState(hoje.getMonth());
  const [selected, setSelected] = useState(todayKey);

  const [activities, setActivities] = useState<CalendarActivity[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [professors, setProfessors] = useState<ProfessorListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Busca o mês inteiro de uma vez; a grade mostra dias vizinhos de outros
  // meses só como preenchimento, sem dado.
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const inicio = dateKey(year, month, 1);
      const ultimoDia = new Date(year, month + 1, 0).getDate();
      const fim = dateKey(year, month, ultimoDia);
      const res = await api.getCalendar(inicio, fim);
      setActivities(res.activities);
      setEvents(res.events);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível carregar o calendário.");
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api.listProfessors().then((res) => setProfessors(res.items)).catch(() => setProfessors([]));
  }, []);

  const activitiesByDay = useMemo(() => {
    const map: Record<string, CalendarActivity[]> = {};
    for (const a of activities) (map[localDateKey(a.created_at)] ??= []).push(a);
    return map;
  }, [activities]);

  const eventsByDay = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const e of events) (map[e.event_date] ??= []).push(e);
    return map;
  }, [events]);

  // Matérias que aparecem no mês — só elas entram na legenda. Listar as três
  // sempre faria a legenda mentir num mês em que só uma foi estudada.
  const materiasDoMes = useMemo(() => {
    const ids = new Set(activities.map((a) => a.professor_id));
    return professors.filter((p) => ids.has(p.id));
  }, [activities, professors]);

  function shiftMonth(delta: number) {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  async function handleCreate(payload: {
    title: string;
    kind: EventKind;
    event_date: string;
    professor_id: string | null;
  }) {
    await api.createEvent(payload);
    await load();
  }

  async function handleDelete(eventId: string) {
    setEvents((prev) => prev.filter((e) => e.id !== eventId));
    try {
      await api.deleteEvent(eventId);
    } catch {
      await load(); // falhou: recarrega pra não deixar a tela mentindo
    }
  }

  const provas = events.filter((e) => e.kind === "prova").length;
  const revisoes = events.length - provas;
  const resumo = [
    provas > 0 ? `${provas} ${provas === 1 ? "prova" : "provas"}` : null,
    revisoes > 0 ? `${revisoes} ${revisoes === 1 ? "evento" : "eventos"}` : null,
  ].filter(Boolean);

  const noMesAtual = year === hoje.getFullYear() && month === hoje.getMonth();

  return (
    <div className="mx-auto max-w-[720px]">
      <PageHeader
        title="Calendário"
        subtitle={
          resumo.length > 0
            ? `${resumo.join(" e ")} em ${MESES[month]}`
            : `Nada marcado em ${MESES[month]}`
        }
        action={
          !noMesAtual || selected !== todayKey ? (
            <button
              type="button"
              onClick={() => {
                setYear(hoje.getFullYear());
                setMonth(hoje.getMonth());
                setSelected(todayKey);
              }}
              className="rounded-chip px-2 py-1 text-[17px] font-medium text-indigo hover:bg-indigo/6 focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte"
            >
              Hoje
            </button>
          ) : undefined
        }
      />

      {error && (
        <div className="mb-4">
          <InlineAlert>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>{error}</span>
              <Capsule variant="secundaria" onClick={load}>
                Tentar novamente
              </Capsule>
            </div>
          </InlineAlert>
        </div>
      )}

      <GlassCard nivel="cartao" radius="grupo" className="p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <button
            type="button"
            aria-label="Mês anterior"
            onClick={() => shiftMonth(-1)}
            className="flex h-toque w-toque items-center justify-center rounded-capsula text-indigo transition-colors duration-140 ease-out hover:bg-indigo/6 focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <p className="text-linha font-semibold capitalize text-tinta">
            {MESES[month]} <MetricText weight="semibold">{year}</MetricText>
          </p>
          <button
            type="button"
            aria-label="Próximo mês"
            onClick={() => shiftMonth(1)}
            className="flex h-toque w-toque items-center justify-center rounded-capsula text-indigo transition-colors duration-140 ease-out hover:bg-indigo/6 focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <Skeleton className="h-[300px] rounded-cartao" />
        ) : (
          <MonthGrid
            year={year}
            month={month}
            activitiesByDay={activitiesByDay}
            eventsByDay={eventsByDay}
            selected={selected}
            today={todayKey}
            onSelect={setSelected}
          />
        )}
      </GlassCard>

      {(materiasDoMes.length > 0 || events.some((e) => e.kind === "prova")) && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 px-rotulo-secao">
          {materiasDoMes.map((p) => (
            <span key={p.id} className="flex items-center gap-1.5 text-nota text-tinta-fraca">
              <span
                aria-hidden
                className={cn("h-2 w-2 flex-none rounded-capsula", professorColor(p.id).bg)}
              />
              {p.name}
            </span>
          ))}
          {events.some((e) => e.kind === "prova") && (
            <span className="flex items-center gap-1.5 text-nota text-tinta-fraca">
              <span aria-hidden className="h-3 w-3 flex-none rounded-[4px] bg-erro/20" />
              dia de prova
            </span>
          )}
        </div>
      )}

      <div className="mt-[22px]">
        <DayPanel
          dateKey={selected}
          activities={activitiesByDay[selected] ?? []}
          events={eventsByDay[selected] ?? []}
          professors={professors}
          onCreate={handleCreate}
          onDelete={handleDelete}
        />
      </div>

      {/* Próxima prova, quando houver — o desenho a destaca em vermelho porque
          é a única data com consequência. */}
      {(() => {
        const proxima = events
          .filter((e) => e.kind === "prova" && e.event_date >= todayKey)
          .sort((a, b) => a.event_date.localeCompare(b.event_date))[0];
        if (!proxima) return null;
        const dias = Math.round(
          (new Date(proxima.event_date).getTime() - new Date(todayKey).getTime()) / 86400000
        );
        return (
          <div className="mt-4 flex items-center gap-3 rounded-alerta bg-erro/10 px-4 py-3">
            <CalendarDays className="h-[17px] w-[17px] flex-none text-erro" />
            <p className="flex-1 text-nota text-tinta">
              {proxima.title}{" "}
              {dias === 0 ? (
                "é hoje"
              ) : (
                <>
                  em <MetricText weight="bold">{dias}</MetricText>{" "}
                  {dias === 1 ? "dia" : "dias"}
                </>
              )}
            </p>
            <MetricText className="flex-none text-nota" tone="erro">
              {proxima.event_date.slice(8, 10)}/{proxima.event_date.slice(5, 7)}
            </MetricText>
          </div>
        );
      })()}
    </div>
  );
}
