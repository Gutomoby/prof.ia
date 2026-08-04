// Cada matéria ganha uma cor de identidade, como etiqueta de caderno: o mesmo
// professor aparece sempre na mesma cor na sidebar, no calendário e na trilha.
//
// A cor é derivada do id (hash estável) em vez de virar coluna no banco —
// mesmo efeito visual, sem migration e sem obrigar o usuário a escolher cor
// ao criar um professor.
//
// Os seis matizes são bem separados de propósito. A paleta do documento tinha
// índigo (243°) e violeta (263°) lado a lado, e com pontos de 6px no calendário
// duas matérias viravam a mesma cor — o violeta virou magenta (294°) para abrir
// esse intervalo. Todos são tons -700: o nó "dominado" da trilha desenha um
// check branco por cima, que precisa de 3:1 contra a cor.

export interface ProfessorColor {
  /** Preenchimento sólido — pontos de identidade e nós dominados da trilha. */
  bg: string;
  /** A mesma cor como texto, para rótulos sobre o fundo da página. */
  text: string;
  /** A mesma cor a 12% — fundo do avatar de matéria na sidebar do desktop.
      Tonal, nunca sólido: a cor de matéria não pode virar fundo de cartão. */
  soft: string;
}

const PALETTE: ProfessorColor[] = [
  { bg: "bg-indigo-700", text: "text-indigo-700 dark:text-indigo-300", soft: "bg-indigo-700/12" },
  { bg: "bg-teal-700", text: "text-teal-700 dark:text-teal-300", soft: "bg-teal-700/12" },
  { bg: "bg-amber-700", text: "text-amber-700 dark:text-amber-300", soft: "bg-amber-700/12" },
  { bg: "bg-rose-700", text: "text-rose-700 dark:text-rose-300", soft: "bg-rose-700/12" },
  { bg: "bg-fuchsia-700", text: "text-fuchsia-700 dark:text-fuchsia-300", soft: "bg-fuchsia-700/12" },
  { bg: "bg-green-700", text: "text-green-700 dark:text-green-300", soft: "bg-green-700/12" },
];

export function professorColor(professorId: string): ProfessorColor {
  let hash = 0;
  for (let i = 0; i < professorId.length; i++) {
    hash = (hash * 31 + professorId.charCodeAt(i)) % 100000;
  }
  return PALETTE[hash % PALETTE.length];
}
