import { computeNextStep, type NextStep } from "./next-step";
import type { ProfessorListItem, ScoreSummary } from "./types";

export interface GlobalNextStep {
  professor: ProfessorListItem;
  step: NextStep;
}

// Quanto menor, mais urgente. Um tópico fraco é a coisa mais valiosa a fazer
// agora; matéria sem material nenhum é a menos urgente porque exige o usuário
// ir buscar um arquivo, não estudar.
const URGENCY: Record<NextStep["kind"], number> = {
  "revisar-topico": 0,
  diagnostico: 1,
  "praticar-tudo": 2,
  "subir-material": 3,
};

/**
 * Escolhe UM próximo passo entre todas as matérias — o que a home mostra como
 * "o que fazer hoje". Dentro do mesmo tipo de urgência, desempata pela matéria
 * com o pior tópico pendente (mais fraco primeiro).
 */
export function computeGlobalNextStep(
  professors: ProfessorListItem[],
  scores: Record<string, ScoreSummary>,
  documentCounts: Record<string, number>
): GlobalNextStep | null {
  const candidates = professors
    .filter((p) => scores[p.id] !== undefined && documentCounts[p.id] !== undefined)
    .map((p) => ({
      professor: p,
      step: computeNextStep({
        hasDocuments: documentCounts[p.id] > 0,
        topics: scores[p.id].topics,
      }),
      worstAccuracy: Math.min(
        ...scores[p.id].topics.filter((t) => t.status === "pendente").map((t) => t.accuracy_pct),
        Infinity
      ),
    }));

  if (candidates.length === 0) return null;

  candidates.sort(
    (a, b) => URGENCY[a.step.kind] - URGENCY[b.step.kind] || a.worstAccuracy - b.worstAccuracy
  );

  const best = candidates[0];
  return { professor: best.professor, step: best.step };
}
