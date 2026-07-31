"use client";

import { useEffect, useState } from "react";
import { Flame, Sparkles, Target, TrendingUp, RotateCcw, Calendar } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InlineAlert } from "@/components/ui/inline-alert";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ScoreTrendChart } from "@/components/score/ScoreTrendChart";
import { scoreBadgeVariant } from "@/lib/utils";
import type { ScoreSummary, StudyPlan } from "@/lib/types";

export default function InicioPage({ params }: { params: { id: string } }) {
  const professorId = params.id;

  const [summary, setSummary] = useState<ScoreSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [planError, setPlanError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  async function loadSummary() {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      setSummary(await api.getScoreSummary(professorId));
    } catch (err) {
      setSummaryError(err instanceof ApiError ? err.message : "Não foi possível carregar seu progresso.");
    } finally {
      setSummaryLoading(false);
    }
  }

  async function loadPlan() {
    setPlanLoading(true);
    setPlanError(null);
    try {
      setPlan(await api.getStudyPlan(professorId));
    } catch (err) {
      setPlanError(err instanceof ApiError ? err.message : "Não foi possível carregar o plano de estudos.");
    } finally {
      setPlanLoading(false);
    }
  }

  useEffect(() => {
    loadSummary();
    loadPlan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professorId]);

  async function handleGeneratePlan() {
    setGenerateError(null);
    setGenerating(true);
    try {
      setPlan(await api.generateStudyPlan(professorId));
    } catch (err) {
      setGenerateError(err instanceof ApiError ? err.message : "Falha ao gerar o plano.");
    } finally {
      setGenerating(false);
    }
  }

  if (summaryLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-32 rounded-xl" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
        <Skeleton className="h-56 rounded-xl" />
      </div>
    );
  }

  if (summaryError || !summary) {
    return (
      <div className="mx-auto max-w-3xl">
        <InlineAlert>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{summaryError ?? "Não foi possível carregar seu progresso."}</span>
            <Button variant="outline" size="sm" onClick={loadSummary}>
              Tentar novamente
            </Button>
          </div>
        </InlineAlert>
      </div>
    );
  }

  const hasHistory = summary.topics.length > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Hero: domínio geral + streak */}
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Target className="h-4 w-4" />
            Domínio geral da matéria
          </div>
          <p className="text-4xl font-bold tabular-nums md:text-5xl">{summary.overall_mastery_pct}%</p>
          <div className="mt-2 flex items-center gap-3">
            <Badge variant={summary.streak_days > 0 ? "success" : "neutral"}>
              <span className="inline-flex items-center gap-1">
                <Flame className="h-3.5 w-3.5" />
                {summary.streak_days} {summary.streak_days === 1 ? "dia" : "dias"} seguidos
              </span>
            </Badge>
            {summary.exam_dates && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                {summary.exam_dates}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Metas */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Meta diária</CardDescription>
            <CardTitle className="text-2xl">
              {summary.streak_days > 0 ? "Em dia 🔥" : "Comece hoje"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Esta semana</CardDescription>
            <CardTitle className="text-2xl">
              {summary.weekly.quizzes_respondidos} {summary.weekly.quizzes_respondidos === 1 ? "quiz" : "quizzes"}
            </CardTitle>
            {summary.weekly.media_score_pct != null && (
              <CardDescription>Média de {summary.weekly.media_score_pct}%</CardDescription>
            )}
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Este mês</CardDescription>
            <CardTitle className="text-2xl">+{summary.monthly.topicos_dominados} tópicos</CardTitle>
            <CardDescription>{summary.monthly.topicos_totais} dominados no total</CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Evolução da pontuação */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Evolução da pontuação
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasHistory ? (
            <ScoreTrendChart points={summary.score_trend} />
          ) : (
            <EmptyState
              icon={TrendingUp}
              title="Ainda sem histórico"
              description="Responda um quiz para começar a ver sua evolução aqui."
            />
          )}
        </CardContent>
      </Card>

      {/* Tópicos dominados vs pendentes */}
      <Card>
        <CardHeader>
          <CardTitle>Tópicos</CardTitle>
          <CardDescription>≥70% de acerto (com pelo menos 2 questões) conta como dominado.</CardDescription>
        </CardHeader>
        <CardContent>
          {hasHistory ? (
            <ul className="divide-y">
              {summary.topics.map((t) => (
                <li key={t.topico} className="flex items-center justify-between gap-4 py-2">
                  <span className="text-sm">{t.topico}</span>
                  <Badge variant={scoreBadgeVariant(t.accuracy_pct)}>{t.accuracy_pct}%</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={Target}
              title="Nenhum tópico testado ainda"
              description="Os tópicos aparecem aqui conforme você responde quizzes."
            />
          )}
        </CardContent>
      </Card>

      {/* Plano de estudos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Plano de estudos
          </CardTitle>
          <CardDescription>Gerado por IA a partir do seu material e do seu progresso.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {planLoading && (
            <div className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          )}

          {!planLoading && planError && <InlineAlert>{planError}</InlineAlert>}

          {!planLoading && !planError && !plan && (
            <EmptyState
              icon={Sparkles}
              title="Nenhum plano gerado ainda"
              description="A IA monta um plano com base no seu material e nos tópicos em que você mais precisa praticar."
            />
          )}

          {!planLoading && !planError && plan && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{plan.content.resumo}</p>

              {plan.content.prioridades.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-medium">Prioridades</p>
                  <div className="flex flex-wrap gap-2">
                    {plan.content.prioridades.map((p) => (
                      <Badge key={p} variant="destructive">
                        {p}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="mb-2 text-sm font-medium">Esta semana</p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {plan.content.semana.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">Este mês</p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {plan.content.mes.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {generateError && <InlineAlert>{generateError}</InlineAlert>}

          <Button onClick={handleGeneratePlan} loading={generating} variant={plan ? "outline" : "default"}>
            {!plan && <Sparkles className="h-4 w-4" />}
            {plan && <RotateCcw className="h-4 w-4" />}
            {generating ? "Gerando..." : plan ? "Atualizar plano" : "Gerar plano de estudos"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
