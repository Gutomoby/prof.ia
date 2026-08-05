"use client";

import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Capsule } from "@/components/ui/capsule";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineAlert } from "@/components/ui/inline-alert";
import { MetricText } from "@/components/ui/metric-text";
import { Skeleton } from "@/components/ui/skeleton";
import { QuizReview } from "@/components/quiz/QuizReview";
import { useStartQuiz } from "@/lib/use-start-quiz";
import { DIFFICULTY_LABELS, type ActivityDetail } from "@/lib/types";

/*
  Tela 40 · Revisão da tentativa. O cabeçalho ("‹ Suas tentativas" e o título
  "Revisão") vem do layout da sala; aqui mora o subtítulo com tópico e data,
  o resumo da tentativa e as questões erradas.
*/

export default function QuizHistoricoDetailPage({
  params,
}: {
  params: { id: string; activityId: string };
}) {
  const { id: professorId, activityId } = params;

  const [detail, setDetail] = useState<ActivityDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Tentativa gerada e abandonada no meio: existe, mas não tem o que revisar.
  // O backend devolve 400 nesse caso, e um alerta seco de erro faria parecer
  // que algo quebrou — quando na verdade não há nada para ver ali.
  const [naoRespondida, setNaoRespondida] = useState(false);

  // Gera o quiz novo aqui mesmo e entrega pra /quiz via sessionStorage, que
  // assume direto a lição — mesmo caminho de todo CTA de prática.
  const { start, generating: retrying, error: retryError } = useStartQuiz(professorId);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      setNaoRespondida(false);
      try {
        setDetail(await api.getAtividade(activityId));
      } catch (err) {
        if (err instanceof ApiError && err.status === 400) setNaoRespondida(true);
        else setError(err instanceof ApiError ? err.message : "Não foi possível carregar essa tentativa.");
      } finally {
        setLoading(false);
      }
    })();
  }, [activityId]);

  if (loading) {
    return (
      <div className="mx-auto flex max-w-[560px] flex-col gap-4">
        <Skeleton className="h-[104px] rounded-grupo" />
        <Skeleton className="h-[200px] rounded-grupo" />
      </div>
    );
  }

  if (naoRespondida) {
    return (
      <div className="mx-auto max-w-[560px]">
        <EmptyState
          kango="confuso"
          size="bloco"
          title="Essa tentativa ficou pela metade"
          description="O quiz foi gerado mas nenhuma resposta chegou ao fim, então não há correção para revisar."
          action={
            <Capsule loading={retrying} onClick={() => start(null)}>
              <RotateCcw className="h-4 w-4" />
              {retrying ? "Gerando..." : "Fazer um quiz novo"}
            </Capsule>
          }
        />
      </div>
    );
  }

  if (error || !detail) {
    return <InlineAlert>{error ?? "Tentativa não encontrada."}</InlineAlert>;
  }

  return (
    <div className="mx-auto flex max-w-[560px] flex-col gap-4">
      <p className="-mt-2 text-[14px] text-tinta-fraca">
        {detail.topic || "Tópico geral"} ·{" "}
        <MetricText tone="fraca">
          {new Date(detail.created_at).toLocaleDateString("pt-BR")}
        </MetricText>
        {detail.difficulty ? ` · ${DIFFICULTY_LABELS[detail.difficulty]}` : ""}
      </p>

      <QuizReview
        scorePct={detail.score_pct}
        questions={detail.questions}
        tempoSegundos={detail.time_seconds}
        footer={
          <div className="mt-2 flex flex-col gap-3">
            {retryError && <InlineAlert>{retryError}</InlineAlert>}
            <Capsule block loading={retrying} onClick={() => start(detail.topic)}>
              {!retrying && <RotateCcw className="h-4 w-4" />}
              {retrying ? "Gerando..." : "Praticar esse tópico de novo"}
            </Capsule>
          </div>
        }
      />
    </div>
  );
}
