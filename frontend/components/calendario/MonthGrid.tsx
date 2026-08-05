import { cn } from "@/lib/utils";
import { MetricText } from "@/components/ui/metric-text";
import { professorColor } from "@/lib/professor-color";
import type { CalendarActivity, CalendarEvent } from "@/lib/types";

/*
  Grade do mês (tela 32).

  Sem grade de linhas: o desenho separa os dias por espaço, não por traço — a
  régua vertical de bordas que existia aqui competia com os pontos de matéria,
  que são a informação real da célula.

  Dia com prova ganha fundo tonal vermelho; hoje é círculo índigo cheio. Os dois
  podem coincidir, e nesse caso o círculo vence: "onde eu estou" é mais urgente
  que "o que tem aqui".
*/

const SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Dias exibidos: o mês inteiro, mais o resto da semana antes e depois para
 * fechar linhas de 7. `inMonth` distingue os dias de preenchimento.
 */
function buildDays(year: number, month: number) {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = first.getDay();

  const cells: { key: string; day: number; inMonth: boolean }[] = [];

  const prevMonthDays = new Date(year, month, 0).getDate();
  for (let i = leading - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, prevMonthDays - i);
    cells.push({
      key: dateKey(d.getFullYear(), d.getMonth(), d.getDate()),
      day: d.getDate(),
      inMonth: false,
    });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ key: dateKey(year, month, d), day: d, inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const d = new Date(year, month + 1, cells.length - leading - daysInMonth + 1);
    cells.push({
      key: dateKey(d.getFullYear(), d.getMonth(), d.getDate()),
      day: d.getDate(),
      inMonth: false,
    });
  }

  return cells;
}

export function MonthGrid({
  year,
  month,
  activitiesByDay,
  eventsByDay,
  selected,
  today,
  onSelect,
}: {
  year: number;
  month: number;
  activitiesByDay: Record<string, CalendarActivity[]>;
  eventsByDay: Record<string, CalendarEvent[]>;
  selected: string;
  today: string;
  onSelect: (key: string) => void;
}) {
  const cells = buildDays(year, month);

  return (
    <div>
      <div className="grid grid-cols-7">
        {SEMANA.map((w) => (
          <div
            key={w}
            className="pb-1.5 text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-tinta-fraca"
          >
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((cell) => {
          const activities = activitiesByDay[cell.key] ?? [];
          const events = eventsByDay[cell.key] ?? [];
          const isSelected = cell.key === selected;
          const isToday = cell.key === today;
          const temProva = events.some((e) => e.kind === "prova");

          // Uma bolinha por matéria distinta estudada no dia (não por quiz),
          // senão um dia produtivo vira uma fileira ilegível de pontos.
          const materias = Array.from(new Set(activities.map((a) => a.professor_id)));

          return (
            <button
              key={cell.key}
              type="button"
              onClick={() => onSelect(cell.key)}
              aria-label={`${cell.day}, ${activities.length} atividades, ${events.length} eventos`}
              aria-current={isToday ? "date" : undefined}
              className={cn(
                "flex flex-col items-center gap-1 rounded-chip py-1",
                "transition-colors duration-140 ease-out",
                "focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte",
                !isToday && temProva && "bg-erro/10",
                !isToday && !temProva && isSelected && "bg-indigo/8",
                !isToday && !temProva && !isSelected && "hover:bg-indigo/5"
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-capsula",
                  isToday && "bg-indigo",
                  !cell.inMonth && "opacity-35"
                )}
              >
                <MetricText
                  className="text-nota"
                  // O miolo índigo do dia de hoje pede número em papel.
                  tone={isToday ? "papel" : temProva ? "erro" : "tinta"}
                  weight={isToday || isSelected ? "bold" : "normal"}
                >
                  {cell.day}
                </MetricText>
              </span>

              {/* Altura fixa: sem ela a linha inteira pula quando um dia ganha
                  ponto e os vizinhos não têm. */}
              <span className="flex h-1.5 flex-wrap justify-center gap-0.5">
                {materias.slice(0, 4).map((professorId) => (
                  <span
                    key={professorId}
                    className={cn("h-1.5 w-1.5 rounded-capsula", professorColor(professorId).bg)}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
