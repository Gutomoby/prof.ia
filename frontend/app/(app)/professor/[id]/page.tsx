"use client";

import { useEffect, useState } from "react";
import { Map } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InlineAlert } from "@/components/ui/inline-alert";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { NextStepCard } from "@/components/professor/NextStepCard";
import { TopicTrail } from "@/components/professor/TopicTrail";
import { computeNextStep } from "@/lib/next-step";
import type { ScoreSummary, DocumentItem } from "@/lib/types";

export default function ProfessorHubPage({ params }: { params: { id: string } }) {
  const professorId = params.id;

  const [summary, setSummary] = useState<ScoreSummary | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, documentsRes] = await Promise.all([
        api.getScoreSummary(professorId),
        api.listDocuments(professorId),
      ]);
      setSummary(summaryRes);
      setDocuments(documentsRes.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível carregar esta matéria.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professorId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-8">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
    );
  }

  if (error || !summary || !documents) {
    return (
      <div className="mx-auto max-w-3xl">
        <InlineAlert>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{error ?? "Não foi possível carregar esta matéria."}</span>
            <Button variant="outline" size="sm" onClick={load}>
              Tentar novamente
            </Button>
          </div>
        </InlineAlert>
      </div>
    );
  }

  const nextStep = computeNextStep({ hasDocuments: documents.length > 0, topics: summary.topics });

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <NextStepCard professorId={professorId} nextStep={nextStep} />

      <Card variant="flat">
        <CardHeader className="px-0 pb-4 pt-0">
          <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Trilha
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {summary.topics.length > 0 ? (
            <TopicTrail topics={summary.topics} professorId={professorId} />
          ) : (
            <EmptyState
              icon={Map}
              title="Nenhum tópico testado ainda"
              description={
                documents.length > 0
                  ? "Use o próximo passo acima pra fazer o diagnóstico inicial."
                  : "Suba o material da matéria pra começar."
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
