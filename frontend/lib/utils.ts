import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/*
  O tailwind-merge só conhece os nomes de tamanho de fonte de fábrica (xs, sm,
  base, lg…). Diante de `text-nota` ele não sabe se é tamanho ou cor, e chuta
  COR — então num cn() o `text-nota` era descartado por conflito com
  `text-tinta`, e a linha caía para 16px em vez de 13px. Silencioso: nada
  quebra, o texto só sai do tamanho errado.

  Registrar os tokens Kango no grupo "font-size" resolve na raiz. Toda vez que
  a escala tipográfica ganhar um nome em tailwind.config.ts, ele entra aqui.
*/
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "titulo-grande",
            "titulo-estado",
            "enunciado",
            "enunciado-lg",
            "titulo-cartao",
            "linha",
            "corpo",
            "nota",
            "rotulo",
          ],
        },
      ],
    },
  },
});

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
