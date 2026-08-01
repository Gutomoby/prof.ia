import { cn } from "@/lib/utils";
import { professorColor } from "@/lib/professor-color";
import type { CalendarActivity, CalendarEvent } from "@/lib/types";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Dias exibidos na grade: o mês inteiro, mais o resto da semana antes e depois
 * para fechar linhas completas de 7 (mesmo desenho de qualquer calendário
 * mensal). `inMonth` distingue os dias do mês atual dos de preenchimento.
 */
function buildDays(year: number, month: number) {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = first.getDay();

  const cells: { key: string; day: number; inMonth: boolean }[] = [];

  const prevMonthDays = new Date(year, month, 0).getDate();
  for (let i = leading - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, prevMonthDays - i);
    cells.push({ key: dateKey(d.getFullYear(), d.getMonth(), d.getDate()), day: d.getDate(), inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ key: dateKey(year, month, d), day: d, inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const d = new Date(year, month + 1, cells.length - leading - daysInMonth + 1);
    cells.push({ key: dateKey(d.getFullYear(), d.getMonth(), d.getDate()), day: d.getDate(), inMonth: false });
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
      <div className="grid grid-cols-7 border-b border-border/60 pb-2">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((cell) => {
          const activities = activitiesByDay[cell.key] ?? [];
          const events = eventsByDay[cell.key] ?? [];
          const isSelected = cell.key === selected;
          const isToday = cell.key === today;

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
                "flex min-h-[3.25rem] flex-col items-center gap-1 border-b border-r border-border/40 p-1 transition-colors first:rounded-tl-lg hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:min-h-[4.5rem] sm:gap-1.5 sm:p-2",
                !cell.inMonth && "text-muted-foreground/40",
                isSelected && "bg-accent"
              )}
            >
              <span
                className={cn(
                  "metric flex h-6 w-6 items-center justify-center rounded-full text-xs sm:h-7 sm:w-7 sm:text-sm",
                  isToday && "bg-primary font-bold text-primary-foreground",
                  !isToday && isSelected && "font-bold"
                )}
              >
                {cell.day}
              </span>

              <span className="flex flex-wrap justify-center gap-0.5 sm:gap-1">
                {materias.slice(0, 4).map((professorId) => (
                  <span
                    key={professorId}
                    className={cn("h-1.5 w-1.5 rounded-full", professorColor(professorId).bg)}
                  />
                ))}
              </span>

              {events.length > 0 && (
                // No celular não cabe o título: vira só um traço vermelho.
                <>
                  <span className="h-1 w-4 rounded-full bg-destructive sm:hidden" aria-hidden />
                  <span className="hidden w-full truncate rounded bg-destructive/10 px-1 text-[10px] font-medium leading-4 text-destructive sm:block">
                    {events.length === 1 ? events[0].title : `${events.length} eventos`}
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
