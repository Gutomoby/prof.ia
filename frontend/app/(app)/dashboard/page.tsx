"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Plus, GraduationCap, Flame } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ProgressStrip } from "@/components/progress/ProgressStrip";
import { TodayCard } from "@/components/progress/TodayCard";
import { computeGlobalNextStep } from "@/lib/global-next-step";
import { professorColor } from "@/lib/professor-color";
import { scoreBadgeVariant } from "@/lib/utils";
import type { ProfessorListItem, ScoreSummary, UserProgress } from "@/lib/types";

export default function DashboardPage() {
  const [professors, setProfessors] = useState<ProfessorListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [scores, setScores] = useState<Record<string, ScoreSummary>>({});
  const [documentCounts, setDocumentCounts] = useState<Record<string, number>>({});
  const [detailsLoading, setDetailsLoading] = useState(true);

  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [progressLoading, setProgressLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listProfessors();
      setProfessors(res.items);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Não foi possível carregar seus professores. O backend está no ar?"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    api
      .getProgress()
      .then(setProgress)
      .catch(() => setProgress(null))
      .finally(() => setProgressLoading(false));
  }, []);

  // Score e contagem de material de cada matéria, em paralelo e resiliente:
  // se uma falhar, as outras continuam aparecendo normalmente.
  useEffect(() => {
    if (professors.length === 0) {
      setDetailsLoading(false);
      return;
    }
    let cancelled = false;
    setDetailsLoading(true);

    Promise.allSettled(
      professors.map((p) =>
        Promise.all([api.getScoreSummary(p.id), api.listDocuments(p.id)]).then(
          ([score, docs]) => ({ id: p.id, score, nDocs: docs.items.length })
        )
      )
    ).then((results) => {
      if (cancelled) return;
      const nextScores: Record<string, ScoreSummary> = {};
      const nextCounts: Record<string, number> = {};
      results.forEach((res) => {
        if (res.status === "fulfilled") {
          nextScores[res.value.id] = res.value.score;
          nextCounts[res.value.id] = res.value.nDocs;
        }
      });
      setScores(nextScores);
      setDocumentCounts(nextCounts);
      setDetailsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [professors]);

  const globalStep = useMemo(
    () => computeGlobalNextStep(professors, scores, documentCounts),
    [professors, scores, documentCounts]
  );

  return (
    <div>
      <PageHeader
        title="Início"
        action={
          <Link href="/professor/novo" className={buttonVariants("default", "default")}>
            <Plus className="h-4 w-4" />
            Novo professor
          </Link>
        }
      />

      {loading && (
        <div className="space-y-6">
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-44 rounded-2xl" />
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-36 rounded-xl" />
            ))}
          </div>
        </div>
      )}

      {!loading && error && (
        <InlineAlert>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={load}>
              Tentar novamente
            </Button>
          </div>
        </InlineAlert>
      )}

      {!loading && !error && professors.length === 0 && (
        <EmptyState
          icon={GraduationCap}
          title="Comece pela matéria que mais te preocupa"
          description="Crie um professor, suba o material dele, e ele passa a estudar com você."
          action={
            <Link href="/professor/novo" className={buttonVariants("default", "default")}>
              <Plus className="h-4 w-4" />
              Criar professor
            </Link>
          }
        />
      )}

      {!loading && !error && professors.length > 0 && (
        <div className="space-y-8">
          <ProgressStrip progress={progress} loading={progressLoading} />

          {detailsLoading ? (
            <Skeleton className="h-44 rounded-2xl" />
          ) : (
            globalStep && <TodayCard globalStep={globalStep} />
          )}

          <div>
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Suas matérias
            </h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {professors.map((p) => {
                const score = scores[p.id];
                const hasData = score && score.topics.length > 0;
                const semMaterial = documentCounts[p.id] === 0;
                const color = professorColor(p.id);

                return (
                  <Card
                    key={p.id}
                    className="flex flex-col overflow-hidden border-border/60 shadow-none transition-shadow hover:shadow-md"
                  >
                    <Link
                      href={`/professor/${p.id}`}
                      className="block flex-1 space-y-2 p-6 transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                    >
                      <div className="space-y-1.5">
                        <h3 className="flex items-center gap-2 text-base font-semibold leading-none tracking-tight">
                          <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${color.bg}`} />
                          {p.name}
                        </h3>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {p.discipline}
                        </p>
                      </div>

                      {detailsLoading ? (
                        <Skeleton className="h-5 w-32" />
                      ) : hasData ? (
                        <div className="flex items-center gap-2">
                          <Badge variant={scoreBadgeVariant(score.overall_mastery_pct)}>
                            {score.overall_mastery_pct}% domínio
                          </Badge>
                          {score.streak_days > 0 && (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Flame className="h-3.5 w-3.5" />
                              {score.streak_days} {score.streak_days === 1 ? "dia" : "dias"}
                            </span>
                          )}
                        </div>
                      ) : (
                        // Estado vazio é convite, não beco sem saída: diz o que
                        // fazer em vez de só "sem dados".
                        <p className="text-xs text-muted-foreground">
                          {semMaterial ? `Sem material ainda — ensine o ${p.name}` : "Faça o diagnóstico inicial"}
                        </p>
                      )}
                    </Link>
                    <CardFooter className="gap-2 border-t border-border/60 pt-3">
                      <Link href={`/professor/${p.id}/quiz`} className={buttonVariants("ghost", "sm", "flex-1")}>
                        Quiz
                      </Link>
                      <Link href={`/professor/${p.id}/configurar`} className={buttonVariants("ghost", "sm", "flex-1")}>
                        Material
                      </Link>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
