import { useRouter } from "next/navigation";
import type { Difficulty } from "./types";

/**
 * Leva o aluno para a lição em tela cheia.
 *
 * Antes isto gerava o quiz aqui e entregava o resultado para /quiz por
 * sessionStorage. Agora quem gera é a própria rota /licao/[id]: o escopo viaja
 * na URL e a espera (tela 23) acontece já dentro do modo foco, sem a casca do
 * app em volta.
 *
 * Mantém a forma antiga (`start`, `generating`, `error`) para as telas que o
 * chamam não precisarem mudar. `generating` fica sempre falso porque não há
 * mais o que esperar aqui — a navegação é imediata, e quem mostra a espera é a
 * tela de destino.
 */
export function useStartQuiz(professorId: string) {
  const router = useRouter();

  function start(
    topic: string | null,
    opts?: { moduleId?: string; difficulty?: Difficulty; rotulo?: string }
  ) {
    const params = new URLSearchParams();
    if (topic) params.set("topic", topic);
    if (opts?.moduleId) params.set("module", opts.moduleId);
    if (opts?.difficulty) params.set("dif", opts.difficulty);
    const rotulo = opts?.rotulo ?? topic;
    if (rotulo) params.set("rotulo", rotulo);

    const qs = params.toString();
    router.push(`/licao/${professorId}${qs ? `?${qs}` : ""}`);
  }

  return { start, generating: false, error: null as string | null };
}
