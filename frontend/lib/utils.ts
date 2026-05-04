import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Helper padrão do shadcn/ui — combina classes condicionais e remove duplicatas
// de forma compatível com Tailwind. Use em todos os componentes:
//   <div className={cn("p-4", isActive && "bg-primary")} />
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
