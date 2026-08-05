import {
  Award,
  BookOpen,
  CalendarCheck,
  CheckCheck,
  Flame,
  Lock,
  Zap,
  type LucideIcon,
} from "lucide-react";

/*
  Catálogo das conquistas: nome, frase, ícone e cor.

  Fica no frontend, e não no backend, porque é copy e design — o que o
  backend devolve é só a verdade (ganha, quando, onde a pessoa está), casada
  por id. Trocar o nome de uma medalha não deveria pedir deploy de API.

  São SETE. O handoff escreve "4 de 9" no cabeçalho da tela 34 mas nomeia
  sete; as outras duas não existem em lugar nenhum do pacote. Inventar nome e
  critério para fechar o número seria inventar produto.

  "Atuário Jr." virou "Três dominados". O nome do desenho só faz sentido em
  Ciências Atuariais, que é a matéria de exemplo — para quem estuda Direito a
  medalha viraria piada interna. As outras seis mantêm o nome e a frase.

  A cor é a do estado quando ela existe (verde de sequência viva, índigo de
  progresso) e a de matéria quando é só identidade — teal e âmbar aparecem
  aqui pelo mesmo motivo da tela 05.
*/

export interface ConquistaCopy {
  nome: string;
  frase: string;
  icone: LucideIcon;
  /** Classe de fundo do disco de 38px quando a conquista está ganha. */
  cor: string;
  /** Unidade do progresso, para "5 de 14 dias". Vazia quando não cabe. */
  unidade: string;
}

export const CATALOGO: Record<string, ConquistaCopy> = {
  "semana-cheia": {
    nome: "Semana cheia",
    frase: "7 dias seguidos estudando",
    icone: Flame,
    cor: "bg-acerto",
    unidade: "dias",
  },
  "duas-semanas": {
    nome: "Duas semanas seguidas",
    frase: "14 dias seguidos estudando",
    icone: CalendarCheck,
    cor: "bg-indigo",
    unidade: "dias",
  },
  "tres-dominados": {
    nome: "Três dominados",
    frase: "Dominou 3 tópicos da mesma matéria",
    icone: Award,
    cor: "bg-indigo",
    unidade: "tópicos",
  },
  "sem-erro": {
    nome: "Sem erro",
    frase: "Um quiz inteiro com 100%",
    icone: CheckCheck,
    cor: "bg-amber-700",
    unidade: "%",
  },
  "kango-alfabetizado": {
    nome: "Kango alfabetizado",
    frase: "Subiu 3 materiais numa matéria",
    icone: BookOpen,
    cor: "bg-teal-700",
    unidade: "materiais",
  },
  "combo-10": {
    nome: "Combo de 10",
    frase: "10 acertos seguidos",
    icone: Zap,
    cor: "bg-indigo",
    unidade: "acertos seguidos",
  },
  "materia-fechada": {
    nome: "Matéria fechada",
    frase: "Dominar todos os tópicos de uma matéria",
    icone: Lock,
    cor: "bg-acerto",
    unidade: "tópicos",
  },
};
