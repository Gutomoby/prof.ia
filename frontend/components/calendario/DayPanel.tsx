"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarPlus, ChevronRight, Trash2 } from "lucide-react";
import { Capsule } from "@/components/ui/capsule";
import { InlineAlert } from "@/components/ui/inline-alert";
import { InsetList } from "@/components/ui/inset-list";
import { MathText } from "@/components/ui/math-text";
import { MetricText } from "@/components/ui/metric-text";
import { Pill, tonePilulaDaNota } from "@/components/ui/pill";
import { Segmented } from "@/components/ui/segmented";
import { professorColor } from "@/lib/professor-color";
import { cn, pctInteiro } from "@/lib/utils";
import type { CalendarActivity, CalendarEvent, EventKind, ProfessorListItem } from "@/lib/types";

/*
  Painel do dia (tela 32).

  Cada linha leva uma barra vertical na cor da matéria, não um ponto: aqui a
  linha é alta e a cor precisa acompanhar o bloco inteiro. O ponto de 7–10px
  continua sendo a regra onde a linha é baixa (lista de matérias, biblioteca).

  Evento e atividade convivem na mesma lista, ordenados pelo que aconteceu
  antes — separá-los em dois grupos faria o aluno cruzar duas listas para saber
  como foi o dia.
*/

const KIND_LABEL: Record<EventKind, string> = {
  prova: "Prova",
  revisao: "Revisão",
  tarefa: "Tarefa",
  outro: "Outro",
};

const KINDS: EventKind[] = ["prova", "revisao", "tarefa", "outro"];

function tituloDoDia(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const data = new Date(y, m - 1, d);
  const texto = data.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function LinhaDoDia({
  cor,
  titulo,
  subtitulo,
  esquerda,
  direita,
  href,
  ultima,
}: {
  cor: string;
  titulo: React.ReactNode;
  subtitulo: React.ReactNode;
  esquerda?: React.ReactNode;
  direita?: React.ReactNode;
  href?: string;
  ultima: boolean;
}) {
  const conteudo = (
    <>
      {esquerda !== undefined && (
        <span className="w-[46px] flex-none text-nota text-tinta-fraca">{esquerda}</span>
      )}
      <span className={cn("h-9 w-[3px] flex-none rounded-capsula", cor)} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] tracking-[-0.43px] text-tinta">{titulo}</span>
        <span className="mt-0.5 block truncate text-nota text-tinta-fraca">{subtitulo}</span>
      </span>
      {direita}
      {!ultima && (
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-4 right-0 h-[0.5px] bg-borda"
        />
      )}
    </>
  );

  const classes = "relative flex min-h-linha-dupla w-full items-center gap-3 px-4 text-left";

  return href ? (
    <Link
      href={href}
      className={cn(
        classes,
        "transition-colors duration-140 ease-out hover:bg-indigo/5",
        "focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte"
      )}
    >
      {conteudo}
    </Link>
  ) : (
    <div className={classes}>{conteudo}</div>
  );
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
      setAdding(false);
    } catch {
      setError("Não foi possível salvar o evento.");
    } finally {
      setSaving(false);
    }
  }

  const vazio = activities.length === 0 && events.length === 0;
  const total = events.length + activities.length;

  return (
    <div className="flex flex-col">
      <div className="mb-2 flex items-baseline justify-between gap-3 px-rotulo-secao">
        <p className="text-rotulo uppercase text-tinta-fraca">{tituloDoDia(dateKey)}</p>
        {activities.length > 0 && (
          <span className="flex-none text-nota text-tinta-fraca">
            <MetricText tone="fraca">{activities.length}</MetricText>{" "}
            {activities.length === 1 ? "lição" : "lições"}
          </span>
        )}
      </div>

      {vazio ? (
        <p className="px-rotulo-secao text-nota text-tinta-fraca">Nada registrado nesse dia.</p>
      ) : (
        <InsetList>
          {events.map((ev, i) => {
            const cor = ev.professor_id ? professorColor(ev.professor_id).bg : "bg-erro";
            return (
              <LinhaDoDia
                key={ev.id}
                cor={ev.kind === "prova" ? "bg-erro" : cor}
                esquerda={KIND_LABEL[ev.kind]}
                titulo={<MathText>{ev.title}</MathText>}
                subtitulo={ev.professor_name ?? "Sem matéria"}
                ultima={i === total - 1}
                direita={
                  <button
                    type="button"
                    onClick={() => onDelete(ev.id)}
                    aria-label={`Apagar ${ev.title}`}
                    className="flex h-toque w-toque flex-none items-center justify-center rounded-capsula text-tinta-fraca transition-colors duration-140 ease-out hover:bg-erro/12 hover:text-erro focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                }
              />
            );
          })}

          {activities.map((a, i) => (
            <LinhaDoDia
              key={a.id}
              cor={professorColor(a.professor_id).bg}
              esquerda="feito"
              titulo={<MathText>{a.topic || "Tópico geral"}</MathText>}
              subtitulo={a.professor_name}
              href={`/professor/${a.professor_id}/quiz/historico/${a.id}`}
              ultima={events.length + i === total - 1}
              direita={
                <span className="flex flex-none items-center gap-2">
                  <Pill tone={tonePilulaDaNota(pctInteiro(a.score_pct))}>
                    <MetricText>{pctInteiro(a.score_pct)}%</MetricText>
                  </Pill>
                  <ChevronRight className="h-[18px] w-[18px] text-borda-forte" />
                </span>
              }
            />
          ))}
        </InsetList>
      )}

      {error && (
        <div className="mt-3">
          <InlineAlert>{error}</InlineAlert>
        </div>
      )}

      {adding ? (
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          <InsetList superficie="solido">
            <label className="relative flex min-h-linha-campo items-center gap-3 px-4">
              <span className="w-[74px] flex-none text-linha text-tinta-fraca">Título</span>
              <input
                autoFocus
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="P3 de Atuariais"
                className="min-w-0 flex-1 bg-transparent text-linha text-tinta focus:outline-none placeholder:text-borda-forte"
              />
              <span
                aria-hidden
                className="pointer-events-none absolute bottom-0 left-4 right-0 h-[0.5px] bg-borda"
              />
            </label>
            <label className="flex min-h-linha-campo items-center gap-3 px-4">
              <span className="w-[74px] flex-none text-linha text-tinta-fraca">Matéria</span>
              <select
                value={professorId}
                onChange={(e) => setProfessorId(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-right text-linha text-tinta focus:outline-none"
              >
                <option value="">Nenhuma</option>
                {professors.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          </InsetList>

          <Segmented
            aria-label="Tipo de evento"
            value={kind}
            onValueChange={(v) => setKind(v as EventKind)}
            options={KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))}
          />

          <div className="flex gap-2">
            <Capsule type="submit" loading={saving} className="flex-1">
              {saving ? "Salvando..." : "Salvar"}
            </Capsule>
            <Capsule
              variant="texto"
              type="button"
              disabled={saving}
              onClick={() => {
                setAdding(false);
                setError(null);
              }}
            >
              Cancelar
            </Capsule>
          </div>
        </form>
      ) : (
        <Capsule variant="secundaria" block className="mt-4" onClick={() => setAdding(true)}>
          <CalendarPlus className="h-[17px] w-[17px]" />
          Adicionar evento
        </Capsule>
      )}
    </div>
  );
}
