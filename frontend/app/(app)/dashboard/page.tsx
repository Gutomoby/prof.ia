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
import { computeCombinedStreak, scoreBadgeVariant } from "@/lib/utils";
import type { ProfessorListItem, ScoreSummary } from "@/lib/types";

export default function DashboardPage() {
  const [professors, setProfessors] = useState<ProfessorListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [scores, setScores] = useState<Record<string, ScoreSummary>>({});
  const [scoresLoading, setScoresLoading] = useState(true);

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
  }, []);

  useEffect(() => {
    if (professors.length === 0) {
      setScoresLoading(false);
      return;
    }
    let cancelled = false;
    setScoresLoading(true);
    Promise.allSettled(professors.map((p) => api.getScoreSummary(p.id))).then((results) => {
      if (cancelled) return;
      const next: Record<string, ScoreSummary> = {};
      results.forEach((res, i) => {
        if (res.status === "fulfilled") next[professors[i].id] = res.value;
      });
      setScores(next);
      setScoresLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professors]);

  const consolidated = useMemo(() => {
    const withData = Object.values(scores).filter((s) => s.topics.length > 0);
    const avgMastery = withData.length
      ? Math.round(withData.reduce((sum, s) => sum + s.overall_mastery_pct, 0) / withData.length)
      : null;
    const allDates = Object.values(scores).flatMap((s) => s.score_trend.map((t) => t.data));
    return {
      totalSubjects: professors.length,
      avgMastery,
      combinedStreak: computeCombinedStreak(allDates),
    };
  }, [scores, professors.length]);

  return (
    <div>
      <PageHeader
        title="Seus professores"
        action={
          <Link href="/professor/novo" className={buttonVariants("default", "default")}>
            <Plus className="h-4 w-4" />
            Novo professor
          </Link>
        }
      />

      {loading && (
        <div className="space-y-6">
          <Skeleton className="h-20 rounded-2xl" />
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
          title="Você ainda não criou nenhum professor"
          description="Comece cadastrando o primeiro assunto que você quer estudar."
          action={
            <Link href="/professor/novo" className={buttonVariants("default", "default")}>
              <Plus className="h-4 w-4" />
              Criar seu primeiro professor
            </Link>
          }
        />
      )}

      {!loading && !error && professors.length > 0 && (
        <div className="space-y-6">
          {/* Resumo consolidado — mesma faixa tonal dividida por hairlines da tela Início */}
          <div className="grid grid-cols-1 divide-y divide-border/60 rounded-2xl bg-muted/50 dark:bg-muted/25 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <div className="px-6 py-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Matérias</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{consolidated.totalSubjects}</p>
            </div>
            <div className="px-6 py-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Domínio médio</p>
              {scoresLoading ? (
                <Skeleton className="mt-1 h-8 w-16" />
              ) : (
                <p className="mt-1 text-2xl font-bold tabular-nums">
                  {consolidated.avgMastery != null ? `${consolidated.avgMastery}%` : "—"}
                </p>
              )}
            </div>
            <div className="px-6 py-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Streak combinado
              </p>
              {scoresLoading ? (
                <Skeleton className="mt-1 h-8 w-16" />
              ) : (
                <p className="mt-1 flex items-center gap-1.5 text-2xl font-bold tabular-nums">
                  {consolidated.combinedStreak > 0 && <Flame className="h-5 w-5 text-success" />}
                  {consolidated.combinedStreak} {consolidated.combinedStreak === 1 ? "dia" : "dias"}
                </p>
              )}
            </div>
          </div>

          {/* Cards de professor, com resumo de progresso sem precisar clicar */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {professors.map((p) => {
              const score = scores[p.id];
              const hasData = score && score.topics.length > 0;
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
                      <h3 className="text-base font-semibold leading-none tracking-tight">{p.name}</h3>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {p.discipline}
                      </p>
                    </div>

                    {scoresLoading ? (
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
                      <p className="text-xs text-muted-foreground">Sem dados ainda</p>
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
      )}
    </div>
  );
}
