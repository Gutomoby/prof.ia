// Cada matéria ganha uma cor de identidade, como etiqueta de caderno: o mesmo
// professor aparece sempre na mesma cor na sidebar, no calendário e na trilha.
//
// A cor é derivada do id (hash estável) em vez de virar coluna no banco —
// mesmo efeito visual, sem migration e sem obrigar o usuário a escolher cor
// ao criar um professor. Paleta do §7.1 do documento de redesenho.

export interface ProfessorColor {
  /** Cor sólida — pontos, nós dominados da trilha. */
  bg: string;
  /** Versão suave — fundos de chip/badge. */
  softBg: string;
  /** Texto sobre o fundo suave. */
  text: string;
  /** Borda, para contornos. */
  border: string;
}

const PALETTE: ProfessorColor[] = [
  { bg: "bg-indigo-700", softBg: "bg-indigo-500/10", text: "text-indigo-700 dark:text-indigo-300", border: "border-indigo-700" },
  { bg: "bg-teal-700", softBg: "bg-teal-500/10", text: "text-teal-700 dark:text-teal-300", border: "border-teal-700" },
  { bg: "bg-amber-700", softBg: "bg-amber-500/10", text: "text-amber-700 dark:text-amber-300", border: "border-amber-700" },
  { bg: "bg-rose-700", softBg: "bg-rose-500/10", text: "text-rose-700 dark:text-rose-300", border: "border-rose-700" },
  { bg: "bg-violet-700", softBg: "bg-violet-500/10", text: "text-violet-700 dark:text-violet-300", border: "border-violet-700" },
  { bg: "bg-green-700", softBg: "bg-green-500/10", text: "text-green-700 dark:text-green-300", border: "border-green-700" },
];

export function professorColor(professorId: string): ProfessorColor {
  let hash = 0;
  for (let i = 0; i < professorId.length; i++) {
    hash = (hash * 31 + professorId.charCodeAt(i)) % 100000;
  }
  return PALETTE[hash % PALETTE.length];
}
