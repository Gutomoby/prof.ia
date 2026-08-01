import type { TopicStat } from "./types";

export type NextStepKind = "subir-material" | "diagnostico" | "revisar-topico" | "praticar-tudo";

export interface NextStep {
  kind: NextStepKind;
  title: string;
  description: string;
  ctaLabel: string;
  // Tópico pra escopar a geração do quiz (null = quiz amplo, IA escolhe).
  topic: string | null;
}

// Regra determinística — sem IA — pra sempre haver exatamente um "próximo
// passo" na Sala do professor. Só usa dado que já existe hoje: se há material
// (listDocuments), e o que ScoreSummary.topics já sabe sobre tópicos testados.
// Não há como saber que tópicos existem no material mas nunca foram cobrados
// em quiz (exigiria extração de tópicos do material, que não existe), então
// esse caso fica de fora — a regra cobre só os 4 estados realmente deriváveis.
export function computeNextStep(params: { hasDocuments: boolean; topics: TopicStat[] }): NextStep {
  const { hasDocuments, topics } = params;

  if (!hasDocuments) {
    return {
      kind: "subir-material",
      title: "Subir material",
      description: "Este professor ainda não tem nenhum material. Suba um PDF ou cole um texto pra começar.",
      ctaLabel: "Subir material",
      topic: null,
    };
  }

  if (topics.length === 0) {
    return {
      kind: "diagnostico",
      title: "Diagnóstico inicial",
      description: "Você já subiu material, mas ainda não respondeu nenhum quiz. Um diagnóstico rápido mostra onde focar.",
      ctaLabel: "Fazer diagnóstico inicial",
      topic: null,
    };
  }

  const pendentes = topics
    .filter((t) => t.status === "pendente")
    .sort((a, b) => a.accuracy_pct - b.accuracy_pct || a.n_questions - b.n_questions);

  if (pendentes.length > 0) {
    const alvo = pendentes[0];
    return {
      kind: "revisar-topico",
      title: alvo.topico,
      description: `Você acertou ${alvo.accuracy_pct}% em ${alvo.n_questions} ${
        alvo.n_questions === 1 ? "questão" : "questões"
      } aqui — é o ponto mais fraco agora.`,
      ctaLabel: `Praticar ${alvo.topico}`,
      topic: alvo.topico,
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
  };
}
