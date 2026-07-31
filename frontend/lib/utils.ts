import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Helper padrão do shadcn/ui — combina classes condicionais e remove duplicatas
// de forma compatível com Tailwind. Use em todos os componentes:
//   <div className={cn("p-4", isActive && "bg-primary")} />
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Mesmo corte usado em toda exibição de score (badge do histórico de quiz,
// tópicos dominados/pendentes no Início): >=70% sucesso, <40% erro, resto neutro.
export function scoreBadgeVariant(scorePct: number): "success" | "destructive" | "neutral" {
  if (scorePct >= 70) return "success";
  if (scorePct < 40) return "destructive";
  return "neutral";
}
