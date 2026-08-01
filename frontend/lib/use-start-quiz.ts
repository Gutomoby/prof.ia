import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "./api";

export function pendingQuizKey(professorId: string) {
  return `pending-quiz-${professorId}`;
}

/**
 * Gera um quiz e leva o usuário direto pra tela de responder.
 *
 * O quiz gerado é entregue via sessionStorage porque a tela /quiz já lê essa
 * chave no mount e pula direto pra `view="respondendo"` — mesmo caminho que o
 * botão "Tentar novamente" do histórico usa. Assim, qualquer CTA de "próximo
 * passo" cai na atividade rodando, sem passar pelo formulário de geração.
 */
export function useStartQuiz(professorId: string) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start(topic: string | null) {
    setError(null);
    setGenerating(true);
    try {
      const generated = await api.generateAtividade({ professor_id: professorId, topic });
      sessionStorage.setItem(pendingQuizKey(professorId), JSON.stringify(generated));
      router.push(`/professor/${professorId}/quiz`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao gerar o quiz.");
      setGenerating(false);
    }
  }

  return { start, generating, error };
}
