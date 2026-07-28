"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ActivityHistoryItem, ActivitySubmitResult, GeneratedActivity } from "@/lib/types";

type View = "idle" | "respondendo" | "resultado";

export default function QuizPage({ params }: { params: { id: string } }) {
  const professorId = params.id;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professorId]);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setGenError(null);
    setGenerating(true);
    try {
      const generated = await api.generateAtividade({ professor_id: professorId, topic: topic || null });
      setActivity(generated);
      setAnswers({});
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

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h2 className="text-2xl font-bold">Quiz</h2>

      {view === "idle" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Gerar novo quiz</CardTitle>
              <CardDescription>Deixe o tópico em branco para a IA escolher.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleGenerate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="topic">Tópico (opcional)</Label>
                  <Input
                    id="topic"
                    placeholder="Ex.: Tábuas de Mortalidade"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                  />
                </div>
                {genError && <p className="text-sm text-destructive">{genError}</p>}
                <Button type="submit" disabled={generating}>
                  {generating ? "Gerando..." : "Gerar quiz"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Histórico</CardTitle>
            </CardHeader>
            <CardContent>
              {historyLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
              {!historyLoading && history.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma tentativa ainda.</p>
              )}
              <ul className="divide-y">
                {history.map((h) => (
                  <li key={h.id} className="flex items-center justify-between py-2 text-sm">
                    <span>{h.topic || "Tópico geral"}</span>
                    <span className="text-muted-foreground">
                      {new Date(h.created_at).toLocaleDateString("pt-BR")}
                    </span>
                    <span className="font-medium">{h.score_pct != null ? `${h.score_pct}%` : "—"}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      )}

      {view === "respondendo" && activity && (
        <div className="space-y-4">
          {activity.questions.map((q, qi) => (
            <Card key={qi}>
              <CardHeader>
                <CardTitle className="text-base">
                  {qi + 1}. {q.enunciado}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {q.alternativas.map((alt, ai) => (
                  <button
                    key={ai}
                    type="button"
                    onClick={() => selectAnswer(qi, ai)}
                    className={cn(
                      "block w-full rounded-md border px-4 py-2 text-left text-sm transition-colors hover:bg-accent",
                      answers[String(qi)] === ai && "border-primary bg-accent"
                    )}
                  >
                    {alt}
                  </button>
                ))}
              </CardContent>
            </Card>
          ))}
          <Button onClick={handleSubmit} disabled={!allAnswered || submitting} className="w-full">
            {submitting ? "Enviando..." : "Enviar respostas"}
          </Button>
        </div>
      )}

      {view === "resultado" && result && (
        <div className="space-y-4">
          <Card>
            <CardContent className="py-6 text-center">
              <p className="text-sm text-muted-foreground">Pontuação</p>
              <p className="text-4xl font-bold">{result.score_pct}%</p>
            </CardContent>
          </Card>

          {result.questions.map((q, qi) => (
            <Card key={qi} className={cn(q.correta ? "border-emerald-500" : "border-destructive")}>
              <CardHeader>
                <CardTitle className="text-base">
                  {qi + 1}. {q.enunciado}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {q.alternativas.map((alt, ai) => (
                  <div
                    key={ai}
                    className={cn(
                      "rounded-md border px-4 py-2 text-sm",
                      ai === q.resposta_correta && "border-emerald-500 bg-emerald-500/10",
                      ai === q.resposta_usuario && ai !== q.resposta_correta && "border-destructive bg-destructive/10"
                    )}
                  >
                    {alt}
                  </div>
                ))}
                <p className="pt-2 text-sm text-muted-foreground">{q.explicacao}</p>
              </CardContent>
            </Card>
          ))}

          <Button onClick={handleReset} className="w-full">
            Novo quiz
          </Button>
        </div>
      )}
    </div>
  );
}
