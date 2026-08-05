import type { Module } from "./types";
import type { TopicEstado } from "@/components/ui/topic-node";

/*
  Trilha da matéria (tela 21).

  A trilha é montada a partir dos MÓDULOS, não dos tópicos de services/scoring.

  Por quê: a trilha precisa de ordem e de um motivo para o bloqueio, e só o
  módulo tem as duas coisas. `Module.position` é a ordem pedagógica que a IA
  definiu lendo o material, e `melhor_score_pct` é o desempenho real naquele
  capítulo.

  Os tópicos de scoring não servem aqui, e não é questão de preferência: eles
  são derivados do campo "topico" que o modelo escreve em cada questão, num
  prompt diferente do que gera os módulos. Os nomes não coincidem. No material
  de Atuária em produção, o módulo tem "Definição de tqx, tpx e força de
  mortalidade μx+t" enquanto o scoring tem "Definição de tqx - Probabilidade de
  morte dentro..." — casar isso por string acertaria pouco e erraria calado,
  que é o pior resultado possível numa tela que diz ao aluno o que estudar.

  Há também uma diferença de granularidade que decide a questão sozinha: são 7
  módulos contra 37 tópicos na mesma matéria. A trilha do desenho tem quatro
  nós; 37 não é uma trilha, é uma lista.
*/

export interface NoTrilha {
  id: string;
  nome: string;
  estado: TopicEstado;
  /** Acurácia do módulo, quando já houve tentativa. */
  pct: number | null;
  tentativas: number;
}

// Mesmo corte de "dominado" do backend (services/scoring.py).
const DOMINIO_PCT = 70;

/**
 * Ordena os módulos e resolve o estado de cada um.
 *
 * A regra de desbloqueio é a do desenho: "libera quando você dominar o
 * anterior". Então tudo antes do primeiro não-dominado está dominado, o
 * primeiro não-dominado é onde o aluno está, e o resto está bloqueado.
 */
export function montarTrilha(modules: Module[]): NoTrilha[] {
  const ordenados = [...modules].sort((a, b) => a.position - b.position);

  let achouAtual = false;
  return ordenados.map((m) => {
    const dominado = m.melhor_score_pct !== null && m.melhor_score_pct >= DOMINIO_PCT;

    let estado: TopicEstado;
    if (dominado) {
      estado = "dominado";
    } else if (!achouAtual) {
      estado = "atual";
      achouAtual = true;
    } else {
      estado = "bloqueado";
    }

    return {
      id: m.id,
      nome: m.name,
      estado,
      pct: m.melhor_score_pct,
      tentativas: m.n_tentativas,
    };
  });
}

/** Pontos que faltam para o módulo virar dominado. */
export function faltamPontos(pct: number | null): number {
  return Math.max(0, DOMINIO_PCT - Math.round(pct ?? 0));
}
