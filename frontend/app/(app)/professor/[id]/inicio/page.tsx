"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, Flame, Sparkles } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Capsule } from "@/components/ui/capsule";
import { GlassCard } from "@/components/ui/glass-card";
import { InlineAlert } from "@/components/ui/inline-alert";
import { InsetList, InsetRow } from "@/components/ui/inset-list";
import { MetricText } from "@/components/ui/metric-text";
import { Pill, tonePilulaDaNota } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";
import { ScoreTrendChart } from "@/components/score/ScoreTrendChart";
import { MathText } from "@/components/ui/math-text";
import { TopicNode } from "@/components/ui/topic-node";
import { PainelAuxiliar, PainelLinha, PainelPrincipal } from "@/components/layout/Painel";
import { faltamPontos, montarTrilha } from "@/lib/trilha";
import { cn, idadeRelativa, pctInteiro } from "@/lib/utils";
import { useStartQuiz } from "@/lib/use-start-quiz";
import type { Module, ScoreSummary, StudyPlan } from "@/lib/types";

/*
  Tela 30 · Progresso da matéria.

  Sobre "+12 pts em 30 dias": o desenho põe isso ao lado do domínio, mas não
  existe retrato histórico de domínio no backend — score_trend guarda a NOTA de
  cada tentativa, não a fração de tópicos dominados. Então o número sai da nota
  e o rótulo diz isso ("na nota"), em vez de deixar um "+12 pts" solto ao lado
  de um percentual que mede outra coisa.

  O plano de estudos (tela 31) virou rota própria — o voltar dela diz
  "Progresso", então a porta é daqui. O handoff não desenha essa linha; sem ela
  o plano ficaria inalcançável.
*/

function Coluna({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="flex-1 px-2 py-3 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-tinta-fraca">
        {rotulo}
      </p>
      <p className="mt-1 text-corpo font-bold text-tinta">{valor}</p>
    </div>
  );
}

export default function ProgressoPage({ params }: { params: { id: string } }) {
  const professorId = params.id;
  const { start } = useStartQuiz(professorId);

  const [summary, setSummary] = useState<ScoreSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Só para a coluna auxiliar do computador (tela 54): quando o plano já
  // existe, ela mostra o resumo dele em vez de só a porta.
  const [plano, setPlano] = useState<StudyPlan | null>(null);
  // Trilha por módulos: determinística (uma leitura do banco), não depende do
  // plano de IA pra estar atualizada — é ela que carrega o "onde estou".
  const [modules, setModules] = useState<Module[]>([]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setSummary(await api.getScoreSummary(professorId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível carregar seu progresso.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // Plano ainda não gerado é estado normal — getStudyPlan devolve null.
    api.getStudyPlan(professorId).then(setPlano).catch(() => setPlano(null));
    // Se falhar, a seção da trilha simplesmente não aparece — o resto da tela
    // não depende dela.
    api.listModules(professorId).then((res) => setModules(res.items)).catch(() => setModules([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professorId]);

  if (loading) {
    return (
      <div className="mx-auto flex max-w-[560px] flex-col gap-4">
        <Skeleton className="mx-auto h-[92px] w-48 rounded-chip" />
        <Skeleton className="h-[72px] rounded-cartao" />
        <Skeleton className="h-[200px] rounded-grupo" />
      </div>
    );
  }

  if (error || !summary) {
    return (
      <InlineAlert>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>{error ?? "Não foi possível carregar seu progresso."}</span>
          <Capsule variant="secundaria" onClick={load}>
            Tentar novamente
          </Capsule>
        </div>
      </InlineAlert>
    );
  }

  const temHistorico = summary.topics.length > 0;
  const dominio = pctInteiro(summary.overall_mastery_pct);
  const trilha = montarTrilha(modules);

  // Delta da NOTA nos últimos 30 dias: primeira contra última tentativa da
  // janela. Só aparece com pelo menos duas — com uma, não há evolução a mostrar.
  const trintaDias = summary.score_trend.filter(
    (p) => Date.now() - new Date(p.data).getTime() <= 30 * 24 * 60 * 60 * 1000
  );
  const delta =
    trintaDias.length >= 2
      ? pctInteiro(trintaDias[trintaDias.length - 1].score_pct) - pctInteiro(trintaDias[0].score_pct)
      : null;

  return (
    /*
      54 · Progresso no computador. A coluna auxiliar de 360px leva os números
      fechados (hoje, semana, mês) e o plano; a principal fica com o que pede
      largura — o gráfico da nota e a lista de tópicos.
    */
    <div className="mx-auto flex w-full max-w-[560px] flex-col md:max-w-none">
      <PainelLinha className="md:flex-1">
        <PainelPrincipal>
      {/* Manchete: o domínio solto, sem caixa. */}
      <div className="flex flex-col items-center py-2 text-center">
        <p className="text-rotulo uppercase text-tinta-fraca">Domínio geral da matéria</p>
        <MetricText as="p" weight="bold" className="mt-1 text-[56px] leading-none tracking-[-0.04em]">
          {dominio}%
        </MetricText>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <Pill tone={summary.streak_days > 0 ? "acerto" : "neutro"}>
            <Flame className="h-3.5 w-3.5" />
            <MetricText>{summary.streak_days}</MetricText>
            {summary.streak_days === 1 ? "dia seguido" : "dias seguidos"}
          </Pill>
          {delta !== null && delta !== 0 && (
            <span className="text-nota text-tinta-fraca">
              <MetricText tone="fraca">
                {delta > 0 ? "+" : ""}
                {delta}
              </MetricText>{" "}
              pts na nota em 30 dias
            </span>
          )}
        </div>
      </div>

      {/* ━━ TRILHA: hero da tela — o "onde estou" vem daqui, não do plano. ━━
          Mesmos nós da Visão Geral (tela 21/52): módulos gerados uma vez,
          estado sai do histórico de quiz. Determinística, sempre atualizada. */}
      {trilha.length > 0 && (
        <>
          <p className="mb-2 mt-[22px] px-rotulo-secao text-rotulo uppercase text-tinta-fraca">
            Sua trilha na matéria
          </p>
          <div className="px-1.5">
            {trilha.map((no, i) => (
              <TopicNode
                key={no.id}
                estado={no.estado}
                nome={<MathText>{no.nome}</MathText>}
                pct={no.tentativas === 0 ? undefined : (no.pct ?? undefined)}
                conector={i < trilha.length - 1}
                onClick={
                  no.estado === "atual"
                    ? () => start(null, { moduleId: no.id, rotulo: no.nome })
                    : undefined
                }
                detalhe={
                  no.estado === "dominado" ? (
                    <>
                      Dominado · <MetricText tone="fraca">{pctInteiro(no.pct ?? 0)}%</MetricText> de
                      acerto
                    </>
                  ) : no.estado === "atual" ? (
                    no.tentativas === 0 ? (
                      "Você está aqui · clique para começar"
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
        </>
      )}

      {/* Hoje, semana, mês — contexto, não guia. */}
      <GlassCard nivel="cartao" radius="cartao" className="mt-[22px] flex items-stretch md:mt-4">
        <Coluna rotulo="Hoje" valor={summary.streak_days > 0 ? "Em dia" : "Comece hoje"} />
        <span aria-hidden className="w-[0.5px] flex-none bg-borda" />
        <Coluna
          rotulo="Semana"
          valor={
            <>
              <MetricText weight="bold">{summary.weekly.quizzes_respondidos}</MetricText>{" "}
              {summary.weekly.quizzes_respondidos === 1 ? "quiz" : "quizzes"}
            </>
          }
        />
        <span aria-hidden className="w-[0.5px] flex-none bg-borda" />
        <Coluna
          rotulo="Mês"
          valor={
            <>
              +<MetricText weight="bold">{summary.monthly.topicos_dominados}</MetricText>{" "}
              {summary.monthly.topicos_dominados === 1 ? "tópico" : "tópicos"}
            </>
          }
        />
      </GlassCard>

      {/* Evolução da nota. */}
      <p className="mb-2 mt-[22px] px-rotulo-secao text-rotulo uppercase text-tinta-fraca">
        Como sua nota evoluiu
      </p>
      {temHistorico ? (
        <GlassCard nivel="cartao" radius="grupo" className="p-4">
          <ScoreTrendChart points={summary.score_trend} />
        </GlassCard>
      ) : (
        <p className="px-rotulo-secao text-nota text-tinta-fraca">
          Responda um quiz para começar a ver sua evolução aqui.
        </p>
      )}

      {/* Tópicos testados. */}
      <p className="mb-2 mt-[22px] px-rotulo-secao text-rotulo uppercase text-tinta-fraca">
        Tópicos testados
      </p>
      {temHistorico ? (
        <InsetList footnote="Acertar 70% com pelo menos 2 questões conta como dominado.">
          {summary.topics.map((t) => {
            const pct = pctInteiro(t.accuracy_pct);
            return (
              <InsetRow
                key={t.topico}
                title={<MathText>{t.topico}</MathText>}
                value={
                  <Pill tone={tonePilulaDaNota(pct)}>
                    <MetricText>{pct}%</MetricText>
                  </Pill>
                }
              />
            );
          })}
        </InsetList>
      ) : (
        <p className="px-rotulo-secao text-nota text-tinta-fraca">
          Os tópicos aparecem aqui conforme você responde quizzes.
        </p>
      )}

        </PainelPrincipal>

        {/* Sugestões (colapsado). O plano de IA é um complemento opcional,
            não o guia principal — a trilha é a fonte de verdade. */}
        <PainelAuxiliar largura={360} className="mt-[22px] md:mt-0">
          <details className="group">
            <summary className="flex cursor-pointer items-center gap-2 rounded-chip px-3 py-2.5 text-corpo font-medium text-indigo hover:bg-indigo/8 focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte">
              <Sparkles className="h-4 w-4" />
              Sugestões do Kango
              <ChevronRight className="ml-auto h-4 w-4 transition-transform group-open:rotate-90" />
            </summary>
            <div className="mt-2 space-y-3">
              {plano && (
                <div className="rounded-cartao bg-indigo/8 p-3">
                  <p className="text-nota text-tinta-fraca">
                    Feito {idadeRelativa(plano.created_at)} · desatualizado é normal
                  </p>
                  <p className="mt-2 text-pretty text-corpo leading-[1.5] text-tinta">
                    {plano.content.resumo}
                  </p>
                </div>
              )}
              <Link
                href={`/professor/${professorId}/plano`}
                className="block rounded-cartao border border-borda px-3 py-2.5 text-centro text-corpo font-medium text-indigo hover:bg-indigo/8 focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte"
              >
                Ver plano completo →
              </Link>
            </div>
          </details>
        </PainelAuxiliar>
      </PainelLinha>
    </div>
  );
}
