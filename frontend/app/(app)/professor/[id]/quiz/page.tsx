"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { History as HistoryIcon, RotateCcw } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { InlineAlert } from "@/components/ui/inline-alert";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { QuizOption } from "@/components/quiz/QuizOption";
import { QuizReview } from "@/components/quiz/QuizReview";
import { useQuizGuard } from "@/components/layout/QuizGuardContext";
import type { ActivityHistoryItem, ActivitySubmitResult, GeneratedActivity } from "@/lib/types";

type View = "idle" | "respondendo" | "resultado";

function scoreBadgeVariant(scorePct: number) {
  if (scorePct >= 70) return "success" as const;
  if (scorePct < 40) return "destructive" as const;
  return "neutral" as const;
}

export default function QuizPage({ params }: { params: { id: string } }) {
  const professorId = params.id;
  const { setUnsaved } = useQuizGuard();

  const [view, setView] = useState<View>("idle");
  const [topic, setTopic] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const [activity, setActivity] = useState<GeneratedActivity | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ActivitySubmitResult | null>(null);

  const [history, setHistory] = useState<ActivityHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    setUnsaved(view === "respondendo");
  }, [view, setUnsaved]);

  useEffect(() => {
    return () => setUnsaved(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshHistory() {
    setHistoryLoading(true);
    try {
      const res = await api.listAtividades(professorId, "quiz");
      setHistory(res.items);
    } catch {
      // histórico é acessório — falha silenciosa não deve travar a tela de quiz
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    refreshHistory();
    // Prefill o tópico se o usuário chegou aqui por "Tentar novamente" a partir
    // do histórico (?topic=...). Lido de window.location em vez de useSearchParams
    // pra não exigir um Suspense boundary só por causa disso.
    const topicParam = new URLSearchParams(window.location.search).get("topic");
    if (topicParam) setTopic(topicParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professorId]);

  async function startQuiz(quizTopic: string | null) {
    setGenError(null);
    setGenerating(true);
    try {
      const generated = await api.generateAtividade({ professor_id: professorId, topic: quizTopic });
      setActivity(generated);
      setAnswers({});
      setResult(null);
      setStartedAt(Date.now());
      setView("respondendo");
    } catch (err) {
      setGenError(err instanceof ApiError ? err.message : "Falha ao gerar o quiz.");
    } finally {
      setGenerating(false);
    }
  }

  function selectAnswer(questionIndex: number, altIndex: number) {
    setAnswers((prev) => ({ ...prev, [String(questionIndex)]: altIndex }));
  }

  async function handleSubmit() {
    if (!activity) return;
    setSubmitting(true);
    try {
      const time_seconds = startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0;
      const res = await api.submitAtividade({
        activity_id: activity.activity_id,
        answers,
        time_seconds,
      });
      setResult(res);
      setView("resultado");
      refreshHistory();
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    setActivity(null);
    setResult(null);
    setTopic("");
    setView("idle");
  }

  const allAnswered = activity ? activity.questions.every((_, i) => answers[String(i)] !== undefined) : false;
  const answeredCount = activity ? activity.questions.filter((_, i) => answers[String(i)] !== undefined).length : 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {view === "idle" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Gerar novo quiz</CardTitle>
              <CardDescription>Deixe o tópico em branco para a IA escolher.</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  startQuiz(topic || null);
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="topic">Tópico (opcional)</Label>
                  <Input
                    id="topic"
                    placeholder="Ex.: Tábuas de Mortalidade"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                  />
                </div>
                {genError && <InlineAlert>{genError}</InlineAlert>}
                <Button type="submit" size="lg" className="w-full" loading={generating}>
                  {generating ? "Gerando..." : "Gerar quiz"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">Histórico</h2>

            {historyLoading && (
              <div className="space-y-2">
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
            )}

            {!historyLoading && history.length === 0 && (
              <Card>
                <EmptyState icon={HistoryIcon} title="Nenhuma tentativa ainda" description="Gere seu primeiro quiz acima." />
              </Card>
            )}

            {!historyLoading &&
              history.map((h) => (
                <Link key={h.id} href={`/professor/${professorId}/quiz/historico/${h.id}`} className="block">
                  <Card className="transition-colors hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <div className="flex items-center justify-between gap-4 p-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{h.topic || "Tópico geral"}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(h.created_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      {h.score_pct != null && (
                        <Badge variant={scoreBadgeVariant(h.score_pct)}>{h.score_pct}%</Badge>
                      )}
                    </div>
                  </Card>
                </Link>
              ))}
          </div>
        </>
      )}

      {view === "respondendo" && activity && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-1.5 flex-1 rounded-full bg-muted">
              <div
                className="h-1.5 rounded-full bg-primary transition-all duration-300"
                style={{ width: `${(answeredCount / activity.questions.length) * 100}%` }}
              />
            </div>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {answeredCount} de {activity.questions.length} respondidas
            </span>
          </div>

          {activity.questions.map((q, qi) => (
            <Card key={qi}>
              <CardHeader>
                <CardTitle>
                  {qi + 1}. {q.enunciado}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {q.alternativas.map((alt, ai) => (
                  <QuizOption
                    key={ai}
                    index={ai}
                    label={alt}
                    state={answers[String(qi)] === ai ? "selected" : "default"}
                    onClick={() => selectAnswer(qi, ai)}
                  />
                ))}
              </CardContent>
            </Card>
          ))}
          <Button onClick={handleSubmit} disabled={!allAnswered} loading={submitting} size="lg" className="w-full">
            {submitting ? "Enviando..." : "Enviar respostas"}
          </Button>
        </div>
      )}

      {view === "resultado" && result && (
        <QuizReview
          scorePct={result.score_pct}
          questions={result.questions}
          footer={
            <div className="space-y-3">
              {genError && <InlineAlert>{genError}</InlineAlert>}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  className="flex-1"
                  size="lg"
                  loading={generating}
                  onClick={() => startQuiz(activity?.topic ?? null)}
                >
                  <RotateCcw className="h-4 w-4" />
                  Tentar novamente
                </Button>
                <Button variant="outline" className="flex-1" size="lg" onClick={handleReset}>
                  Novo quiz
                </Button>
              </div>
            </div>
          }
        />
      )}
    </div>
  );
}
