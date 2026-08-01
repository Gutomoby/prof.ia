"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Skeleton } from "@/components/ui/skeleton";
import { MonthGrid, dateKey } from "@/components/calendario/MonthGrid";
import { DayPanel } from "@/components/calendario/DayPanel";
import { localDateKey } from "@/lib/utils";
import type {
  CalendarActivity,
  CalendarEvent,
  EventKind,
  ProfessorListItem,
} from "@/lib/types";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
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
    api
      .listProfessors()
      .then((res) => setProfessors(res.items))
      .catch(() => setProfessors([]));
  }, []);

  const activitiesByDay = useMemo(() => {
    const map: Record<string, CalendarActivity[]> = {};
    for (const a of activities) {
      const key = localDateKey(a.created_at);
      (map[key] ??= []).push(a);
    }
    return map;
  }, [activities]);

  const eventsByDay = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const e of events) {
      (map[e.event_date] ??= []).push(e);
    }
    return map;
  }, [events]);

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

  return (
    <div>
      <PageHeader title="Calendário" />

      {error && (
        <InlineAlert>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={load}>
              Tentar novamente
            </Button>
          </div>
        </InlineAlert>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_20rem]">
        <div>
          <div className="mb-4 flex items-center gap-2">
            <Button variant="ghost" size="icon" aria-label="Mês anterior" onClick={() => shiftMonth(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="min-w-[10rem] text-lg font-semibold">
              {MESES[month]} {year}
            </h2>
            <Button variant="ghost" size="icon" aria-label="Próximo mês" onClick={() => shiftMonth(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => {
                setYear(hoje.getFullYear());
                setMonth(hoje.getMonth());
                setSelected(todayKey);
              }}
            >
              Hoje
            </Button>
          </div>

          {loading ? (
            <Skeleton className="h-[28rem] rounded-xl" />
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
        </div>

        <Card variant="elevated" className="h-fit rounded-2xl">
          <CardContent className="p-6">
            <DayPanel
              dateKey={selected}
              activities={activitiesByDay[selected] ?? []}
              events={eventsByDay[selected] ?? []}
              professors={professors}
              onCreate={handleCreate}
              onDelete={handleDelete}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
