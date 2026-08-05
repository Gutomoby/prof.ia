"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronRight, Clock, Layers, RotateCcw, Search, Sparkles } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Capsule, capsuleVariants } from "@/components/ui/capsule";
import { GlassCard } from "@/components/ui/glass-card";
import { InlineAlert } from "@/components/ui/inline-alert";
import { InsetList, InsetRow } from "@/components/ui/inset-list";
import { KangoPlaceholder } from "@/components/ui/kango-placeholder";
import { MetricText } from "@/components/ui/metric-text";
import { Pill, tonePilulaDaNota } from "@/components/ui/pill";
import { ProgressBar } from "@/components/ui/gauge";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { QuizOption } from "@/components/quiz/QuizOption";
import { QuizReview } from "@/components/quiz/QuizReview";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuizGuard } from "@/components/layout/QuizGuardContext";
import { pendingQuizKey } from "@/lib/use-start-quiz";
import { cn, pctInteiro } from "@/lib/utils";
import {
  DIFFICULTY_LABELS,
  type ActivityHistoryItem,
  type ActivitySubmitResult,
  type Difficulty,
  type GeneratedActivity,
  type Module,
  type ScoreSummary,
} from "@/lib/types";

/*
  Tela 22 · Fazer um quiz, e 23 · Gerando o quiz (o mesmo caminho, esperando).

  Responder e resultado (telas 37 a 39) continuam como estavam: sao a Fase D e
  tem desenho proprio.

  Duas coisas do desenho que este app tem e a tela 22 nao mostra, e que eu
  mantive em vez de remover:

  - Dificuldade. E funcionalidade que ja existe (routers/atividades.py recebe
    `difficulty`), e o plano ja previa transforma-la em Segmented na Fase D.
  - Modulos. A trilha da tela 21 aponta para ca justamente para o aluno fazer o
    quiz do capitulo; sem a lista, aquele caminho morre.

  Sobre a tela 23: o desenho tem uma lista de tres passos com check verde em
  "Achou os trechos do seu material". Esses passos existem no backend
  (search_chunks -> geracao -> validacao), mas a geracao e uma requisicao so:
  o cliente nao observa em qual passo esta. Pintar um check sem saber seria
  afirmar um fato que ninguem verificou, entao aqui os tres passos aparecem
  como o que vai acontecer, com a barra indeterminada marcando a espera.
*/

type View = "idle" | "gerando" | "respondendo" | "resultado";

// Deriva de DIFFICULTY_LABELS para o seletor e o histórico não divergirem —
// a ordem é a do produto (mais fácil primeiro), não a do objeto.
const DIFICULDADES: { value: Difficulty; label: string }[] = (
  ["facil", "medio", "dificil"] as const
).map((value) => ({ value, label: DIFFICULTY_LABELS[value] }));

export default function QuizPage({ params }: { params: { id: string } }) {
  const professorId = params.id;
  const { setUnsaved } = useQuizGuard();

  const [view, setView] = useState<View>("idle");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("medio");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  // Do que o quiz em geração é — alimenta o título da tela 23.
  const [gerandoDe, setGerandoDe] = useState<string | null>(null);

  const [activity, setActivity] = useState<GeneratedActivity | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<ActivitySubmitResult | null>(null);

  const [history, setHistory] = useState<ActivityHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [modules, setModules] = useState<Module[]>([]);
  const [summary, setSummary] = useState<ScoreSummary | null>(null);

  useEffect(() => {
    setUnsaved(view === "respondendo");
  }, [view, setUnsaved]);

  useEffect(() => {
    return () => setUnsaved(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshHistory() {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await api.listAtividades(professorId, "quiz");
      setHistory(res.items);
    } catch (err) {
      setHistoryError(err instanceof ApiError ? err.message : "Não foi possível carregar o histórico.");
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    refreshHistory();
    api.listModules(professorId).then((r) => setModules(r.items)).catch(() => setModules([]));
    api.getScoreSummary(professorId).then(setSummary).catch(() => setSummary(null));

    // "Tentar novamente" a partir da revisão do histórico já gera o quiz por lá
    // e deixa o resultado aqui via sessionStorage.
    const pendingRaw = sessionStorage.getItem(pendingQuizKey(professorId));
    if (pendingRaw) {
      sessionStorage.removeItem(pendingQuizKey(professorId));
      try {
        const pending: GeneratedActivity = JSON.parse(pendingRaw);
        setActivity(pending);
        setAnswers({});
        setResult(null);
        setStartedAt(Date.now());
        setView("respondendo");
      } catch {
        // payload inválido — o usuário gera um quiz normalmente
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professorId]);

  async function startQuiz(opts: { topic?: string | null; moduleId?: string | null; rotulo?: string }) {
    setGenError(null);
    setGenerating(true);
    setGerandoDe(opts.rotulo ?? opts.topic ?? null);
    setView("gerando");
    try {
      const generated = await api.generateAtividade({
        professor_id: professorId,
        topic: opts.topic ?? null,
        module_id: opts.moduleId ?? null,
        difficulty,
      });
      setActivity(generated);
      setAnswers({});
      setResult(null);
      setStartedAt(Date.now());
      setView("respondendo");
    } catch (err) {
      setGenError(err instanceof ApiError ? err.message : "Falha ao gerar o quiz.");
      setView("idle");
    } finally {
      setGenerating(false);
    }
  }

  function selectAnswer(questionIndex: number, altIndex: number) {
    setAnswers((prev) => ({ ...prev, [String(questionIndex)]: altIndex }));
  }

  async function handleSubmit() {
    if (!activity) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const time_seconds = startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0;
      const res = await api.submitAtividade({ activity_id: activity.activity_id, answers, time_seconds });
      setResult(res);
      setView("resultado");
      refreshHistory();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Falha ao enviar as respostas.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    setActivity(null);
    setResult(null);
    setTopic("");
    setGenError(null);
    setView("idle");
  }

  const allAnswered = activity ? activity.questions.every((_, i) => answers[String(i)] !== undefined) : false;
  const answeredCount = activity ? activity.questions.filter((_, i) => answers[String(i)] !== undefined).length : 0;

  const answeredHistory = history.filter((h) => h.score_pct != null);

  // Sugestões de tópico: os mais fracos primeiro, que é o que o desenho
  // destaca. O primeiro chip vem com a acurácia porque é o convite.
  const sugestoes = (summary?.topics ?? [])
    .filter((t) => t.status === "pendente")
    .sort((a, b) => a.accuracy_pct - b.accuracy_pct)
    .slice(0, 4);

  // ── 23 · Gerando o quiz ──────────────────────────────────────────────────
  if (view === "gerando") {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-[520px] flex-col items-center text-center">
        <div className="flex w-full justify-end">
          <button
            type="button"
            onClick={() => setView("idle")}
            className="rounded-chip px-2 py-1 text-[17px] font-medium text-indigo hover:bg-indigo/6 focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte"
          >
            Cancelar
          </button>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center">
          <KangoPlaceholder px={132} estado="folheando o material" />

          <h1 className="mt-6 text-pretty text-[28px] font-bold leading-[34px] tracking-[-0.02em] text-tinta">
            {gerandoDe ? <>Montando seu quiz de {gerandoDe}</> : "Montando seu quiz"}
          </h1>
          <p className="mt-2 text-corpo text-tinta-fraca">
            Leva uns <MetricText tone="fraca">10</MetricText> segundos.
          </p>

          <div className="mt-6 w-full">
            <InsetList>
              {[
                "Procurar os trechos do seu material",
                "Escrever as questões",
                "Conferir as respostas",
              ].map((passo) => (
                <InsetRow key={passo} title={<span className="text-tinta-fraca">{passo}</span>} />
              ))}
            </InsetList>
          </div>

          <ProgressBar
            className="mt-4 w-full animate-pulse"
            value={100}
            aria-label="Gerando o quiz"
          />
          <p className="mt-2.5 text-nota text-tinta-fraca">
            As questões saem só do material que você enviou.
          </p>
        </div>

        <p className="flex items-center gap-3 pb-6 pt-8 text-left text-nota leading-[1.4] text-tinta-fraca">
          <Sparkles className="h-[17px] w-[17px] flex-none text-acerto" />
          Dica: acertar <MetricText tone="fraca">70%</MetricText> de um tópico duas vezes marca ele
          como dominado.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[560px]">
      {view === "idle" && (
        <div className="flex flex-col gap-[22px]">
          {genError && <InlineAlert>{genError}</InlineAlert>}

          <InsetList label="Tipo de atividade">
            <InsetRow
              active
              altura="dupla"
              icon={<Check />}
              iconTone="indigo"
              title="Quiz"
              subtitle={
                <>
                  <MetricText tone="fraca">5 a 8</MetricText> questões · você vê o acerto na hora
                </>
              }
              trailing={<Check className="h-5 w-5 text-indigo" />}
            />
            <InsetRow
              disabled
              altura="dupla"
              icon={<Clock />}
              title={<span className="text-tinta-fraca">Reforço, Simulado e Prova</span>}
              subtitle="Em breve, por enquanto tudo é quiz"
            />
          </InsetList>

          <div>
            <p className="mb-2 px-rotulo-secao text-rotulo uppercase text-tinta-fraca">
              Dificuldade
            </p>
            <Segmented
              aria-label="Dificuldade das questões"
              value={difficulty}
              onValueChange={(v) => setDifficulty(v as Difficulty)}
              options={DIFICULDADES}
            />
          </div>

          <div>
            <p className="mb-2 px-rotulo-secao text-rotulo uppercase text-tinta-fraca">
              Sobre qual tópico?
            </p>
            <GlassCard nivel="cartao" radius="grupo" className="p-4">
              <div className="flex h-10 items-center gap-2.5 rounded-chip bg-cinza-tonal px-3">
                <Search className="h-4 w-4 flex-none text-tinta-fraca" aria-hidden />
                <input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Ex.: Tábuas de Mortalidade"
                  aria-label="Tópico do quiz"
                  className="min-w-0 flex-1 bg-transparent text-[16px] text-tinta focus:outline-none placeholder:text-borda-forte"
                />
              </div>

              {sugestoes.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {sugestoes.map((t, i) => {
                    const escolhido = topic === t.topico;
                    return (
                      <button
                        key={t.topico}
                        type="button"
                        onClick={() => setTopic(escolhido ? "" : t.topico)}
                        aria-pressed={escolhido}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-capsula px-[11px] py-1.5 text-nota",
                          "transition-colors duration-140 ease-out",
                          "focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte",
                          escolhido || i === 0
                            ? "bg-indigo/10 font-semibold text-indigo"
                            : "bg-cinza-tonal font-medium text-tinta-fraca hover:bg-borda"
                        )}
                      >
                        <span className="max-w-[13rem] truncate">{t.topico}</span>
                        {i === 0 && (
                          <MetricText weight="bold">{pctInteiro(t.accuracy_pct)}%</MetricText>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </GlassCard>
            <p className="mt-2 px-rotulo-secao text-nota leading-[1.4] text-tinta-fraca">
              Deixe em branco e o Kango escolhe o tópico em que você está mais fraco.
            </p>
          </div>

          <Capsule
            block
            loading={generating}
            onClick={() => startQuiz({ topic: topic || null, rotulo: topic || undefined })}
          >
            <Sparkles className="h-[17px] w-[17px]" />
            Gerar quiz
          </Capsule>

          {modules.length > 0 && (
            <InsetList
              label="Ou o capítulo inteiro"
              footnote="Quiz do módulo cobre todos os tópicos do capítulo, com 8 a 10 questões."
            >
              {modules
                .slice()
                .sort((a, b) => a.position - b.position)
                .map((m) => (
                  <InsetRow
                    key={m.id}
                    altura="dupla"
                    icon={<Layers />}
                    title={m.name}
                    subtitle={
                      m.n_tentativas === 0 ? (
                        "Nunca tentado"
                      ) : (
                        <>
                          <MetricText tone="fraca">{m.n_tentativas}</MetricText>{" "}
                          {m.n_tentativas === 1 ? "tentativa" : "tentativas"}
                        </>
                      )
                    }
                    value={
                      m.melhor_score_pct === null ? undefined : (
                        <Pill tone={tonePilulaDaNota(pctInteiro(m.melhor_score_pct))}>
                          <MetricText>{pctInteiro(m.melhor_score_pct)}%</MetricText>
                        </Pill>
                      )
                    }
                    onClick={() => startQuiz({ moduleId: m.id, rotulo: m.name })}
                    trailing={<ChevronRight className="h-[18px] w-[18px]" />}
                  />
                ))}
            </InsetList>
          )}

          <div>
            <div className="mb-2 flex items-baseline justify-between gap-3 px-rotulo-secao">
              <p className="text-rotulo uppercase text-tinta-fraca">Suas tentativas</p>
              {answeredHistory.length > 0 && (
                <span className="text-nota font-semibold text-tinta-fraca">
                  <MetricText tone="fraca">{answeredHistory.length}</MetricText> no total
                </span>
              )}
            </div>

            {historyLoading ? (
              <Skeleton className="h-[104px] rounded-grupo" />
            ) : historyError ? (
              <InlineAlert>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span>{historyError}</span>
                  <Capsule variant="secundaria" onClick={refreshHistory}>
                    Tentar novamente
                  </Capsule>
                </div>
              </InlineAlert>
            ) : answeredHistory.length === 0 ? (
              <p className="px-rotulo-secao text-nota text-tinta-fraca">
                Nenhuma tentativa ainda. Gere o primeiro quiz aqui em cima.
              </p>
            ) : (
              <InsetList>
                {answeredHistory.slice(0, 8).map((h) => (
                  <InsetRow
                    key={h.id}
                    href={`/professor/${professorId}/quiz/historico/${h.id}`}
                    altura="dupla"
                    title={h.topic || "Tópico geral"}
                    subtitle={
                      <>
                        <MetricText tone="fraca">
                          {new Date(h.created_at).toLocaleDateString("pt-BR")}
                        </MetricText>
                        {h.difficulty ? ` · ${DIFFICULTY_LABELS[h.difficulty]}` : ""}
                      </>
                    }
                    value={
                      <Pill tone={tonePilulaDaNota(pctInteiro(h.score_pct as number))}>
                        <MetricText>{pctInteiro(h.score_pct as number)}%</MetricText>
                      </Pill>
                    }
                    trailing={<ChevronRight className="h-[18px] w-[18px]" />}
                  />
                ))}
              </InsetList>
            )}
          </div>
        </div>
      )}

      {/* Responder e resultado seguem na casca antiga — são a Fase D. */}
      {view === "respondendo" && activity && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <ProgressBar
              className="flex-1"
              value={(answeredCount / activity.questions.length) * 100}
              aria-label="Progresso do quiz"
            />
            <span className="shrink-0 text-nota text-tinta-fraca">
              <MetricText tone="fraca">
                {answeredCount}/{activity.questions.length}
              </MetricText>{" "}
              respondidas
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
          {submitError && <InlineAlert>{submitError}</InlineAlert>}
          <Button onClick={handleSubmit} disabled={!allAnswered} loading={submitting} size="lg" className="w-full">
            {submitting ? "Enviando..." : "Enviar respostas"}
          </Button>
        </div>
      )}

      {view === "resultado" && result && (
        <QuizReview
          scorePct={result.score_pct}
          questions={result.questions}
          reward={{
            xpGanho: result.xp_ganho,
            topicosDominados: result.topicos_dominados,
            currentStreak: result.current_streak,
          }}
          footer={
            <div className="space-y-3">
              {genError && <InlineAlert>{genError}</InlineAlert>}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  className="flex-1"
                  size="lg"
                  loading={generating}
                  onClick={() =>
                    startQuiz(
                      activity?.module_id
                        ? { moduleId: activity.module_id }
                        : { topic: activity?.topic ?? null, rotulo: activity?.topic ?? undefined }
                    )
                  }
                >
                  <RotateCcw className="h-4 w-4" />
                  Tentar novamente
                </Button>
                <Link href={`/professor/${professorId}/quiz`} onClick={handleReset} className={capsuleVariants("secundaria")}>
                  Novo quiz
                </Link>
              </div>
            </div>
          }
        />
      )}
    </div>
  );
}
