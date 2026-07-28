"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Skeleton } from "@/components/ui/skeleton";
import { QuizReview } from "@/components/quiz/QuizReview";
import type { ActivityDetail } from "@/lib/types";

export default function QuizHistoricoDetailPage({
  params,
}: {
  params: { id: string; activityId: string };
}) {
  const { id: professorId, activityId } = params;

  const [detail, setDetail] = useState<ActivityDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        setDetail(await api.getAtividade(activityId));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Não foi possível carregar essa tentativa.");
      } finally {
        setLoading(false);
      }
    })();
  }, [activityId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="mx-auto max-w-2xl">
        <InlineAlert>{error ?? "Tentativa não encontrada."}</InlineAlert>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{detail.topic || "Tópico geral"}</p>
          <p className="text-xs text-muted-foreground">
            Respondido em {new Date(detail.created_at).toLocaleDateString("pt-BR")}
          </p>
        </div>
        <Badge variant="neutral">Revisão</Badge>
      </div>

      <QuizReview
        scorePct={detail.score_pct}
        questions={detail.questions}
        footer={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href={`/professor/${professorId}/quiz?topic=${encodeURIComponent(detail.topic ?? "")}`}
              className={buttonVariants("default", "lg", "flex-1")}
            >
              <RotateCcw className="h-4 w-4" />
              Tentar novamente
            </Link>
            <Link href={`/professor/${professorId}/quiz`} className={buttonVariants("outline", "lg", "flex-1")}>
              Novo quiz
            </Link>
          </div>
        }
      />
    </div>
  );
}
