import type { Module, TopicStat } from "./types";
import { faltamPontos, montarTrilha } from "./trilha";
import { pctInteiro } from "./utils";

export type NextStepKind =
  | "subir-material"
  | "diagnostico"
  | "modulo"
  | "revisar-topico"
  | "praticar-tudo";

export interface NextStep {
  kind: NextStepKind;
  title: string;
  description: string;
  ctaLabel: string;
  /** Tópico pra escopar a geração do quiz (null = quiz amplo, IA escolhe). */
  topic: string | null;
  /** Módulo a cobrar, quando o passo veio da trilha. Tem precedência sobre `topic`. */
  moduleId: string | null;
}

/*
  Regra determinística — sem IA — pra sempre haver exatamente um "próximo
  passo".

  A sugestão sai da TRILHA (módulos), não dos tópicos de scoring. Os dois
  existem e medem coisas diferentes: o módulo é o capítulo que a IA definiu
  lendo o material, e o tópico é o campo "topico" que o modelo escreve em cada
  questão gerada — são ~7 módulos contra ~111 tópicos na mesma matéria.

  Sugerir por tópico dava um passo ruim por construção. O desempate era por
  MENOS questões, então o alvo escolhido era sempre um tópico visto uma única
  vez e errado uma única vez: "Você acertou 0% em 1 questão aqui — é o ponto
  mais fraco agora". Uma resposta errada não é diagnóstico, e o aluno era
  mandado para um assunto hiperespecífico em vez do capítulo onde ele está.

  O caminho por tópico continua abaixo como reserva, para matéria que ainda não
  tem trilha montada — e lá o desempate foi invertido para privilegiar o tópico
  com MAIS evidência, pelo mesmo motivo.
*/
export function computeNextStep(params: {
  hasDocuments: boolean;
  topics: TopicStat[];
  modules?: Module[];
}): NextStep {
  const { hasDocuments, topics, modules } = params;

  if (!hasDocuments) {
    return {
      kind: "subir-material",
      title: "Subir material",
      description:
        "Este professor ainda não tem nenhum material. Suba um PDF ou cole um texto pra começar.",
      ctaLabel: "Subir material",
      topic: null,
      moduleId: null,
    };
  }

  // --- Caminho principal: a trilha ---
  if (modules && modules.length > 0) {
    const trilha = montarTrilha(modules);
    const atual = trilha.find((no) => no.estado === "atual");
    const dominados = trilha.filter((no) => no.estado === "dominado").length;

    if (atual) {
      const posicao = trilha.indexOf(atual) + 1;
      return {
        kind: "modulo",
        title: atual.nome,
        description:
          atual.tentativas === 0
            ? `Capítulo ${posicao} de ${trilha.length} da sua trilha. Você ainda não foi testado nele.`
            : `Seu melhor resultado aqui foi ${pctInteiro(atual.pct ?? 0)}%. Faltam ${faltamPontos(
                atual.pct
              )} pontos pra dominar o capítulo.`,
        ctaLabel: atual.tentativas === 0 ? "Começar capítulo" : "Tentar de novo",
        topic: null,
        moduleId: atual.id,
      };
    }

    // Sem nó "atual" a trilha inteira está dominada.
    return {
      kind: "praticar-tudo",
      title: "Trilha concluída",
      description: `Você dominou os ${dominados} capítulos da matéria. Um quiz geral mistura tudo e mostra o que ficou frouxo.`,
      ctaLabel: "Praticar tudo",
      topic: null,
      moduleId: null,
    };
  }

  // --- Reserva: matéria sem trilha montada ---
  if (topics.length === 0) {
    return {
      kind: "diagnostico",
      title: "Diagnóstico inicial",
      description:
        "Você já subiu material, mas ainda não respondeu nenhum quiz. Um diagnóstico rápido mostra onde focar.",
      ctaLabel: "Fazer diagnóstico inicial",
      topic: null,
      moduleId: null,
    };
  }

  // Mais questões primeiro: um tópico errado uma vez só não é ponto fraco, é
  // ruído. O corte de 2 é o mesmo MIN_QUESTIONS_FOR_MASTERY do backend.
  const pendentes = topics
    .filter((t) => t.status === "pendente")
    .sort((a, b) => a.accuracy_pct - b.accuracy_pct || b.n_questions - a.n_questions);
  const alvo = pendentes.find((t) => t.n_questions >= 2) ?? pendentes[0];

  if (alvo) {
    return {
      kind: "revisar-topico",
      title: alvo.topico,
      description: `Você acertou ${pctInteiro(alvo.accuracy_pct)}% em ${alvo.n_questions} ${
        alvo.n_questions === 1 ? "questão" : "questões"
      } aqui — é o ponto mais fraco agora.`,
      // Rótulo curto e fixo, como na tela 14. Interpolar o nome do tópico aqui
      // estourava a cápsula em duas ou três linhas com tópico longo, e era
      // redundante: o título logo acima já é o nome do tópico.
      ctaLabel: "Praticar esse tópico",
      topic: alvo.topico,
      moduleId: null,
    };
  }

  return {
    kind: "praticar-tudo",
    title: "Todos os tópicos testados estão dominados",
    description: `Você domina os ${topics.length} ${
      topics.length === 1 ? "tópico testado" : "tópicos testados"
    } até agora. Hora de ampliar ou reforçar com um quiz geral.`,
    ctaLabel: "Praticar tudo",
    topic: null,
    moduleId: null,
  };
}
