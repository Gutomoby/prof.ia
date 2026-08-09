"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  ChevronRight,
  FileText,
  FileUp,
  FileWarning,
  Play,
  TrendingDown,
  TrendingUp,
  Type,
  Zap,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Capsule, capsuleVariants } from "@/components/ui/capsule";
import { Gauge } from "@/components/ui/gauge";
import { GlassCard } from "@/components/ui/glass-card";
import { InlineAlert } from "@/components/ui/inline-alert";
import { InsetList, InsetRow } from "@/components/ui/inset-list";
import { MetricText } from "@/components/ui/metric-text";
import { Skeleton, SkeletonLinha } from "@/components/ui/skeleton";
import { TopicNode } from "@/components/ui/topic-node";
import { MathText } from "@/components/ui/math-text";
import { PainelAuxiliar, PainelLinha, PainelPrincipal } from "@/components/layout/Painel";
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
      /*
        45 · Carregando a matéria. O link de volta, a engrenagem e a régua de
        abas já vieram reais do layout da sala — o cliente sabe todos os três.
        Aqui pulsa só o que vem da API, e o cartão de próximo passo mantém o
        índigo tonal: a cor é do CARTÃO, não do dado que ainda não chegou.
      */
      <div className="mx-auto flex max-w-[720px] flex-col gap-3">
        <GlassCard nivel="cartao" radius="grupo" className="flex items-center gap-3.5 p-4">
          <Skeleton className="h-[84px] w-[84px] flex-none rounded-capsula" />
          <div className="flex-1 space-y-2">
            <SkeletonLinha className="w-3/4" />
            <SkeletonLinha className="h-2.5 w-1/2" />
            <SkeletonLinha className="h-2.5 w-2/3" />
          </div>
        </GlassCard>

        <div className="space-y-2.5 rounded-grupo bg-indigo/10 px-4 py-3.5">
          <SkeletonLinha className="h-2.5 w-24 bg-indigo/15" />
          <SkeletonLinha className="h-5 w-2/3 bg-indigo/15" />
          <SkeletonLinha className="w-full bg-indigo/15" />
          <Skeleton className="mt-2 h-capsula-principal w-full rounded-capsula bg-indigo/15" />
        </div>

        <div className="mt-2">
          <p className="mb-2 px-rotulo-secao text-rotulo uppercase text-tinta-fraca">
            Trilha da matéria
          </p>
          <div className="flex flex-col gap-4 px-1.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3.5">
                <Skeleton className="h-10 w-10 flex-none rounded-capsula" />
                <div className="flex-1 space-y-1.5">
                  <SkeletonLinha className="w-1/2" />
                  <SkeletonLinha className="h-2.5 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        </div>
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

  // 13 · Matéria sem material. Sem arquivo o Kango não tem o que cobrar, e a
  // sala inteira (domínio, trilha, próximo passo) fica sem lastro — então ela
  // dá lugar ao caminho de ensinar.
  if (documents.length === 0) {
    return (
      <div className="mx-auto flex max-w-[560px] flex-col gap-[22px]">
        <div className="rounded-grupo bg-acerto/10 p-4">
          <p className="flex items-center gap-2 text-corpo font-semibold text-acerto">
            <FileWarning className="h-4 w-4 flex-none" />
            Ainda não tenho o que cobrar
          </p>
          <p className="mt-1.5 text-pretty text-[15px] leading-[1.5] text-tinta">
            Sem material eu não invento questão. Suba uma apostila, um resumo ou uma prova antiga
            e eu monto os quizzes em minutos.
          </p>
        </div>

        <InsetList label="Comece por aqui">
          <InsetRow
            href={`/professor/${professorId}/configurar`}
            altura="dupla"
            icon={<FileUp />}
            iconTone="indigo"
            title="Subir um PDF"
            subtitle="Apostila, lista, prova antiga"
            trailing={<ChevronRight className="h-[18px] w-[18px]" />}
          />
          <InsetRow
            href={`/professor/${professorId}/configurar`}
            altura="dupla"
            icon={<Type />}
            title="Colar um texto"
            subtitle="Anotação da aula serve"
            trailing={<ChevronRight className="h-[18px] w-[18px]" />}
          />
        </InsetList>
      </div>
    );
  }

  const step = computeNextStep({ hasDocuments: documents.length > 0, topics: summary.topics });
  const dominio = pctInteiro(summary.overall_mastery_pct);
  const dominados = summary.topics.filter((t) => t.status === "dominado").length;
  const trilha = montarTrilha(modules);
  const media = summary.weekly.media_score_pct;

  return (
    /*
      52 · Painel de estudo, no computador.

      No celular isto é uma pilha: domínio, próximo passo, trilha, rodapé. No
      computador vira o painel do handoff — duas linhas, cada uma com a coluna
      auxiliar de 250px à direita:

        [ próximo passo          ] [ anel de domínio ]
        [ trilha da matéria      ] [ semana e mês · material lido ]

      A ordem da pilha do celular é a ordem do DOM, então a leitura em voz alta
      e o Tab continuam iguais nas duas larguras — ver components/layout/Painel.
    */
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-3 md:max-w-none md:gap-[22px]">
      <PainelLinha>
        <PainelPrincipal>
          {/* Próximo passo — no celular é o único cartão em índigo tonal da
              tela. No computador ele divide a linha com o anel, e dois fundos
              diferentes lado a lado brigariam: ali o cartão é de vidro e o
              acento fica no rótulo, que é o que o desenho da 52 faz. */}
          <div className="flex flex-1 flex-col rounded-grupo bg-indigo/10 px-4 py-3.5 md:vidro-cartao md:p-5 md:shadow-vidro">
        <p className="flex items-center gap-[7px] text-[11px] font-semibold uppercase tracking-[0.06em] text-indigo">
          <ChevronRight className="h-3.5 w-3.5" />
          Siga sua trilha
        </p>
        <MathText
          as="p"
          className="mt-[7px] text-[19px] font-bold leading-tight tracking-[-0.02em] text-tinta md:mt-2.5 md:text-titulo-cartao"
        >
          {step.title}
        </MathText>
        <MathText as="p" className="mt-1 text-pretty text-[14px] leading-[1.45] text-tinta">
          {step.description}
        </MathText>

        {startError && (
          <div className="mt-3">
            <InlineAlert>{startError}</InlineAlert>
          </div>
        )}

        {/* No computador o cartão estica até a altura do anel ao lado, e o
            botão desce para o pé em vez de flutuar no meio. */}
        <div className="hidden flex-1 md:block" />

        {/* No celular a cápsula ocupa a linha inteira, como toda ação
            principal de tela estreita. No computador ela volta ao tamanho do
            texto: uma cápsula de 900px de largura não é botão, é faixa. */}
        <div className="mt-3.5 md:mt-4">
          {step.kind === "subir-material" ? (
            <Link
              href={`/professor/${professorId}/configurar`}
              className={capsuleVariants("principal", true, "md:w-fit")}
            >
              {step.ctaLabel}
            </Link>
          ) : (
            <Capsule
              block
              className="md:w-fit"
              loading={generating}
              onClick={() => start(step.topic)}
            >
              {!generating && <Play className="h-[15px] w-[15px] fill-papel" />}
              {generating ? "Gerando..." : "Começar agora"}
            </Capsule>
          )}
        </div>
          </div>
        </PainelPrincipal>

        {/* Domínio da matéria. Deitado no celular, em pé no computador —
            é o mesmo dado, no formato que cada largura comporta. */}
        <PainelAuxiliar>
          <GlassCard
            nivel="cartao"
            radius="grupo"
            className="flex flex-1 items-center gap-3.5 p-4 md:flex-col md:justify-center md:gap-0 md:p-5 md:text-center"
          >
            <Gauge value={dominio} size="guia" tone="indigo" className="md:hidden" />
            <Gauge value={dominio} size="desktop" tone="indigo" className="hidden md:flex" />
            <div className="min-w-0 flex-1 md:flex-none">
              <p className="text-linha font-bold text-tinta md:mt-3.5">
                Você já domina <MetricText weight="bold">{dominio}%</MetricText> da matéria
              </p>
              <p className="mt-[3px] text-nota leading-[1.4] text-tinta-fraca">
                <MetricText tone="fraca">{dominados}</MetricText> de{" "}
                <MetricText tone="fraca">{summary.topics.length}</MetricText>{" "}
                {summary.topics.length === 1 ? "tópico dominado" : "tópicos dominados"}
              </p>
              {media !== null && (
                <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-nota leading-[1.4] text-tinta-fraca md:justify-center">
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
        </PainelAuxiliar>
      </PainelLinha>

      <PainelLinha className="md:flex-1">
        <PainelPrincipal>
          {/* Trilha da matéria. */}
          <div className="mt-2 md:mt-0">
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
                nome={<MathText>{no.nome}</MathText>}
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
        </PainelPrincipal>

        <PainelAuxiliar>
          {/* Semana e mês. Deitado no celular; no computador vira duas linhas
              empilhadas, que é o que cabe em 250px. */}
          <GlassCard
            nivel="cartao"
            radius="alerta"
            className="mt-2 flex items-center gap-3.5 px-4 py-3 md:mt-0 md:flex-col md:items-stretch md:gap-3 md:rounded-grupo md:p-4"
          >
            <p className="flex-1 text-nota leading-[1.35] text-tinta-fraca md:flex-none">
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

            <span
              aria-hidden
              className="h-[30px] w-[0.5px] flex-none bg-borda md:h-[0.5px] md:w-full"
            />

            <p className="flex-1 text-nota leading-[1.35] text-tinta-fraca md:flex-none">
              Este mês
              <br />
              <span className="text-corpo font-bold text-tinta">
                +<MetricText weight="bold">{summary.monthly.topicos_dominados}</MetricText>{" "}
                {summary.monthly.topicos_dominados === 1 ? "tópico dominado" : "tópicos dominados"}
              </span>
            </p>
          </GlassCard>

          {/* Material lido só existe no computador: no celular ele já é a aba
              Material inteira, e repetir a lista na sala seria dizer duas vezes
              a mesma coisa numa tela que já rola. */}
          <div className="hidden md:block">
            <p className="mb-2 px-4 text-rotulo uppercase text-tinta-fraca">Material lido</p>
            <InsetList>
              {documents.slice(0, 4).map((doc) => (
                <InsetRow
                  key={doc.id}
                  href={`/professor/${professorId}/configurar`}
                  icon={doc.type === "pdf" ? <FileText /> : <Type />}
                  iconVariant="simples"
                  title={doc.name}
                />
              ))}
              {documents.length > 4 && (
                <InsetRow
                  href={`/professor/${professorId}/configurar`}
                  title={
                    <span className="text-indigo">
                      Ver os <MetricText tone="indigo">{documents.length}</MetricText> materiais
                    </span>
                  }
                />
              )}
            </InsetList>
          </div>
        </PainelAuxiliar>
      </PainelLinha>
    </div>
  );
}
