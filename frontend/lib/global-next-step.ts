import { computeNextStep, type NextStep } from "./next-step";
import { montarTrilha } from "./trilha";
import type { Module, ProfessorListItem, ScoreSummary } from "./types";

export interface GlobalNextStep {
  professor: ProfessorListItem;
  step: NextStep;
}

// Quanto menor, mais urgente. Seguir a trilha é o laço principal do app, então
// vem primeiro; matéria sem material nenhum é a menos urgente porque exige o
// usuário ir buscar um arquivo, não estudar.
const URGENCY: Record<NextStep["kind"], number> = {
  modulo: 0,
  diagnostico: 1,
  "revisar-topico": 2,
  "praticar-tudo": 3,
  "subir-material": 4,
};

/**
 * Escolhe UM próximo passo entre todas as matérias — o que a home mostra como
 * "o que fazer hoje". Dentro do mesmo tipo de urgência, desempata pelo pior
 * desempenho: o capítulo (ou tópico) mais fraco primeiro.
 */
export function computeGlobalNextStep(
  professors: ProfessorListItem[],
  scores: Record<string, ScoreSummary>,
  documentCounts: Record<string, number>,
  modules: Record<string, Module[]> = {}
): GlobalNextStep | null {
  const candidates = professors
    .filter((p) => scores[p.id] !== undefined && documentCounts[p.id] !== undefined)
    .map((p) => {
      const step = computeNextStep({
        hasDocuments: documentCounts[p.id] > 0,
        topics: scores[p.id].topics,
        modules: modules[p.id],
      });

      // Desempate: o quão fraco está o alvo sugerido. Para um capítulo, a
      // melhor nota nele; para um tópico, a acurácia. Sem alvo, Infinity —
      // vai para o fim do seu próprio grupo de urgência.
      let fraqueza = Infinity;
      if (step.kind === "modulo") {
        const atual = montarTrilha(modules[p.id] ?? []).find((no) => no.estado === "atual");
        fraqueza = atual?.pct ?? 0;
      } else if (step.kind === "revisar-topico") {
        fraqueza = Math.min(
          ...scores[p.id].topics.filter((t) => t.status === "pendente").map((t) => t.accuracy_pct),
          Infinity
        );
      }

      return { professor: p, step, fraqueza };
    });

  if (candidates.length === 0) return null;

  candidates.sort(
    (a, b) => URGENCY[a.step.kind] - URGENCY[b.step.kind] || a.fraqueza - b.fraqueza
  );

  const best = candidates[0];
  return { professor: best.professor, step: best.step };
}
