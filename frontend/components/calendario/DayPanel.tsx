"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarPlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InlineAlert } from "@/components/ui/inline-alert";
import { professorColor } from "@/lib/professor-color";
import { pctInteiro, scoreBadgeVariant } from "@/lib/utils";
import type { CalendarActivity, CalendarEvent, EventKind, ProfessorListItem } from "@/lib/types";

const KIND_LABEL: Record<EventKind, string> = {
  prova: "Prova",
  revisao: "Revisão",
  tarefa: "Tarefa",
  outro: "Outro",
};

function formatLongDate(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function DayPanel({
  dateKey,
  activities,
  events,
  professors,
  onCreate,
  onDelete,
}: {
  dateKey: string;
  activities: CalendarActivity[];
  events: CalendarEvent[];
  professors: ProfessorListItem[];
  onCreate: (payload: {
    title: string;
    kind: EventKind;
    event_date: string;
    professor_id: string | null;
  }) => Promise<void>;
  onDelete: (eventId: string) => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<EventKind>("prova");
  const [professorId, setProfessorId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setError(null);
    setSaving(true);
    try {
      await onCreate({
        title: title.trim(),
        kind,
        event_date: dateKey,
        professor_id: professorId || null,
      });
      setTitle("");
      setProfessorId("");
      setAdding(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar o evento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {formatLongDate(dateKey)}
        </h2>
      </div>

      {events.length > 0 && (
        <div className="space-y-2">
          {events.map((ev) => (
            <div key={ev.id} className="flex items-start justify-between gap-3 rounded-lg bg-muted/50 p-3 dark:bg-muted/25">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{ev.title}</p>
                <p className="text-xs text-muted-foreground">
                  {KIND_LABEL[ev.kind]}
                  {ev.professor_name ? ` · ${ev.professor_name}` : ""}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remover ${ev.title}`}
                onClick={() => onDelete(ev.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {activities.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Você estudou</p>
          {activities.map((a) => (
            <Link
              key={a.id}
              href={`/professor/${a.professor_id}/quiz/historico/${a.id}`}
              className="flex items-center justify-between gap-3 rounded-lg p-2 transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="min-w-0">
                <p className="truncate text-sm">{a.topic || "Tópico geral"}</p>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${professorColor(a.professor_id).bg}`} />
                  {a.professor_name}
                </p>
              </div>
              <Badge variant={scoreBadgeVariant(pctInteiro(a.score_pct))} className="metric">
                {pctInteiro(a.score_pct)}%
              </Badge>
            </Link>
          ))}
        </div>
      )}

      {activities.length === 0 && events.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground">Nada registrado nesse dia.</p>
      )}

      {error && <InlineAlert>{error}</InlineAlert>}

      {adding ? (
        <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-border/60 p-4">
          <div className="space-y-2">
            <Label htmlFor="ev-title">O quê</Label>
            <Input
              id="ev-title"
              autoFocus
              placeholder="Ex.: Prova P3 de Duas Vidas"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ev-kind">Tipo</Label>
            <select
              id="ev-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as EventKind)}
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {(Object.keys(KIND_LABEL) as EventKind[]).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ev-prof">Matéria (opcional)</Label>
            <select
              id="ev-prof"
              value={professorId}
              onChange={(e) => setProfessorId(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <option value="">Nenhuma</option>
              {professors.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.discipline}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <Button type="submit" loading={saving} disabled={!title.trim()} className="flex-1">
              {saving ? "Salvando..." : "Salvar"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="outline" className="w-full" onClick={() => setAdding(true)}>
          <CalendarPlus className="h-4 w-4" />
          Adicionar evento
        </Button>
      )}
    </div>
  );
}
