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

// Chave YYYY-MM-DD no fuso local do navegador. Usada pra agrupar atividades
// por dia no calendário: os timestamps chegam em UTC, mas o "dia" que importa
// é o de quem estudou (mesma regra do backend, que usa America/Sao_Paulo).
export function localDateKey(iso: string): string {
  const d = new Date(iso);
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}
