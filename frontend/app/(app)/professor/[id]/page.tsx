"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarDays, Play, TrendingDown, TrendingUp, Zap } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Capsule, capsuleVariants } from "@/components/ui/capsule";
import { EmptyState } from "@/components/ui/empty-state";
import { Gauge } from "@/components/ui/gauge";
import { GlassCard } from "@/components/ui/glass-card";
import { InlineAlert } from "@/components/ui/inline-alert";
import { MetricText } from "@/components/ui/metric-text";
import { Skeleton } from "@/components/ui/skeleton";
import { TopicNode } from "@/components/ui/topic-node";
import { computeNextStep } from "@/lib/next-step";
import { faltamPontos, montarTrilha } from "@/lib/trilha";
import { useStartQuiz } from "@/lib/use-start-quiz";
import { cn, pctInteiro } from "@/lib/utils";
import type { DocumentItem, Module, ScoreSummary } from "@/lib/types";

/*
  Tela 21 · Sala do professor · visão geral.

  O cabeçalho (volta, nome, ponto de cor, abas) vem do layout da sala.

  Sobre o número grande: overall_mastery_pct é a FRAÇÃO DE TÓPICOS DOMINADOS
  (routers/score.py), não a média de acerto. E "dominado" exige >=70% com pelo
  menos 2 questões no tópico (services/scoring.py). Como a maior parte dos
  tópicos nasce com uma questão só, eles não podem ser dominados por
  construção — a conta em produção hoje dá 5% de domínio para quem tem 85% de
  média na semana. A tela mostra o número que o backend calcula e escreve ao
  lado o que ele significa, em vez de deixar um "5%" solto parecendo nota.
*/

export default function ProfessorHubPage({ params }: { params: { id: string } }) {
  const professorId = params.id;

  const [summary, setSummary] = useState<ScoreSummary | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[] | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { start, generating, error: startError } = useStartQuiz(professorId);

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
    // A trilha é um extra: se os módulos não existirem ou a chamada falhar, a
    // tela continua de pé sem ela.
    api
      .listModules(professorId)
      .then((res) => setModules(res.items))
      .catch(() => setModules([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professorId]);

  if (loading) {
    return (
      <div className="mx-auto flex max-w-[720px] flex-col gap-4">
        <Skeleton className="h-[124px] rounded-grupo" />
        <Skeleton className="h-[180px] rounded-grupo" />
        <Skeleton className="h-[200px] rounded-grupo" />
      </div>
    );
  }

  if (error || !summary || !documents) {
    return (
      <InlineAlert>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>{error ?? "Não foi possível carregar esta matéria."}</span>
          <Capsule variant="secundaria" onClick={load}>
            Tentar novamente
          </Capsule>
        </div>
      </InlineAlert>
    );
  }

  const step = computeNextStep({ hasDocuments: documents.length > 0, topics: summary.topics });
  const dominio = pctInteiro(summary.overall_mastery_pct);
  const dominados = summary.topics.filter((t) => t.status === "dominado").length;
  const trilha = montarTrilha(modules);
  const media = summary.weekly.media_score_pct;

  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-3">
      {/* Domínio da matéria. */}
      <GlassCard nivel="cartao" radius="grupo" className="flex items-center gap-3.5 p-4">
        <Gauge value={dominio} size="guia" tone="indigo" />
        <div className="min-w-0 flex-1">
          <p className="text-linha font-bold text-tinta">
            Você já domina <MetricText weight="bold">{dominio}%</MetricText> da matéria
          </p>
          <p className="mt-[3px] text-nota leading-[1.4] text-tinta-fraca">
            <MetricText tone="fraca">{dominados}</MetricText> de{" "}
            <MetricText tone="fraca">{summary.topics.length}</MetricText>{" "}
            {summary.topics.length === 1 ? "tópico dominado" : "tópicos dominados"}
          </p>
          {media !== null && (
            <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-nota leading-[1.4] text-tinta-fraca">
              {media >= 70 ? (
                <TrendingUp className="h-3.5 w-3.5 flex-none text-acerto" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 flex-none text-erro" />
              )}
              <MetricText tone="fraca">{pctInteiro(media)}%</MetricText> de acerto nesta semana
              {summary.exam_dates && (
                <>
                  <span aria-hidden>·</span>
                  <CalendarDays className="h-3.5 w-3.5 flex-none" />
                  <span className="truncate">{summary.exam_dates}</span>
                </>
              )}
            </p>
          )}
        </div>
      </GlassCard>

      {/* Próximo passo — o único cartão em índigo tonal da tela. */}
      <div className="rounded-grupo bg-indigo/10 px-4 py-3.5">
        <p className="flex items-center gap-[7px] text-[11px] font-semibold uppercase tracking-[0.06em] text-indigo">
          <Zap className="h-3.5 w-3.5" />
          Próximo passo
        </p>
        <p className="mt-[7px] text-[19px] font-bold leading-tight tracking-[-0.02em] text-tinta">
          {step.title}
        </p>
        <p className="mt-1 text-pretty text-[14px] leading-[1.45] text-tinta">{step.description}</p>

        {startError && (
          <div className="mt-3">
            <InlineAlert>{startError}</InlineAlert>
          </div>
        )}

        <div className="mt-3.5">
          {step.kind === "subir-material" ? (
            <Link
              href={`/professor/${professorId}/configurar`}
              className={capsuleVariants("principal", true)}
            >
              {step.ctaLabel}
            </Link>
          ) : (
            <Capsule block loading={generating} onClick={() => start(step.topic)}>
              {!generating && <Play className="h-[15px] w-[15px] fill-papel" />}
              {generating ? "Gerando..." : "Começar agora"}
            </Capsule>
          )}
        </div>
      </div>

      {/* Trilha da matéria. */}
      <div className="mt-2">
        <p className="mb-2 px-rotulo-secao text-rotulo uppercase text-tinta-fraca">
          Trilha da matéria
        </p>

        {trilha.length === 0 ? (
          <p className="px-rotulo-secao text-nota text-tinta-fraca">
            {documents.length === 0
              ? "Suba o material da matéria para o Kango montar a trilha."
              : "O Kango ainda não organizou este material em capítulos. Abra a aba Quiz para pedir a organização."}
          </p>
        ) : (
          <div className="px-1.5">
            {trilha.map((no, i) => (
              <TopicNode
                key={no.id}
                estado={no.estado}
                nome={no.nome}
                // Sem tentativa não há acurácia: um "0%" no anel leria como
                // "você zerou", quando o capítulo sequer foi aberto.
                pct={no.tentativas === 0 ? undefined : (no.pct ?? undefined)}
                conector={i < trilha.length - 1}
                href={no.estado === "bloqueado" ? undefined : `/professor/${professorId}/quiz`}
                detalhe={
                  no.estado === "dominado" ? (
                    <>
                      Dominado · <MetricText tone="fraca">{pctInteiro(no.pct ?? 0)}%</MetricText> de
                      acerto
                    </>
                  ) : no.estado === "atual" ? (
                    no.tentativas === 0 ? (
                      "Você está aqui · comece por este capítulo"
                    ) : (
                      <>
                        Você está aqui · faltam{" "}
                        <MetricText tone="indigo">{faltamPontos(no.pct)}</MetricText> pontos pra
                        dominar
                      </>
                    )
                  ) : (
                    "Libera quando você dominar o anterior"
                  )
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Rodapé: semana e mês, lado a lado. */}
      <GlassCard nivel="cartao" radius="alerta" className="mt-2 flex items-center gap-3.5 px-4 py-3">
        <p className="flex-1 text-nota leading-[1.35] text-tinta-fraca">
          Esta semana
          <br />
          <span className="text-corpo font-bold text-tinta">
            <MetricText weight="bold">{summary.weekly.quizzes_respondidos}</MetricText>{" "}
            {summary.weekly.quizzes_respondidos === 1 ? "quiz" : "quizzes"}
            {media !== null && (
              <>
                {" · "}
                <MetricText weight="bold">{pctInteiro(media)}%</MetricText>
              </>
            )}
          </span>
        </p>

        <span aria-hidden className="h-[30px] w-[0.5px] flex-none bg-borda" />

        <p className="flex-1 text-nota leading-[1.35] text-tinta-fraca">
          Este mês
          <br />
          <span className="text-corpo font-bold text-tinta">
            +<MetricText weight="bold">{summary.monthly.topicos_dominados}</MetricText>{" "}
            {summary.monthly.topicos_dominados === 1 ? "tópico dominado" : "tópicos dominados"}
          </span>
        </p>
      </GlassCard>

      {summary.topics.length === 0 && documents.length === 0 && (
        <EmptyState
          kango="acenando"
          size="bloco"
          title="Ensine o Kango primeiro"
          description="Sem material ele não tem o que cobrar. Suba a apostila, um resumo ou uma prova antiga."
          action={
            <Link
              href={`/professor/${professorId}/configurar`}
              className={capsuleVariants("secundaria")}
            >
              Subir material
            </Link>
          }
        />
      )}
    </div>
  );
}
