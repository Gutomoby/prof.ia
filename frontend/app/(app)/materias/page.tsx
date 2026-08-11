"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Plus, GraduationCap } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Capsule, capsuleVariants } from "@/components/ui/capsule";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineAlert } from "@/components/ui/inline-alert";
import { InsetList } from "@/components/ui/inset-list";
import { GlassCard } from "@/components/ui/glass-card";
import { Skeleton, SkeletonLinha } from "@/components/ui/skeleton";
import { MateriaRow } from "@/components/professor/MateriaRow";
import { ProgressStrip } from "@/components/progress/ProgressStrip";
import { TodayCard } from "@/components/progress/TodayCard";
import { MiniCalendar } from "@/components/progress/MiniCalendar";
import { computeGlobalNextStep } from "@/lib/global-next-step";
import type { Module, ProfessorListItem, ScoreSummary, UserProgress } from "@/lib/types";

export default function MateriasPage() {
  const [professors, setProfessors] = useState<ProfessorListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [scores, setScores] = useState<Record<string, ScoreSummary>>({});
  const [documentCounts, setDocumentCounts] = useState<Record<string, number>>({});
  // A trilha entra na conta do próximo passo, então precisa ser buscada aqui
  // também — sem ela esta tela sugeriria um tópico enquanto a home e a sala
  // sugerem um capítulo, para a mesma matéria.
  const [modules, setModules] = useState<Record<string, Module[]>>({});
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
        Promise.all([
          api.getScoreSummary(p.id),
          api.listDocuments(p.id),
          api.listModules(p.id).catch(() => ({ items: [] })),
        ]).then(([score, docs, mods]) => ({
          id: p.id,
          score,
          nDocs: docs.items.length,
          modules: mods.items,
        }))
      )
    ).then((results) => {
      if (cancelled) return;
      const nextScores: Record<string, ScoreSummary> = {};
      const nextCounts: Record<string, number> = {};
      const nextModules: Record<string, Module[]> = {};
      results.forEach((res) => {
        if (res.status === "fulfilled") {
          nextScores[res.value.id] = res.value.score;
          nextCounts[res.value.id] = res.value.nDocs;
          nextModules[res.value.id] = res.value.modules;
        }
      });
      setScores(nextScores);
      setDocumentCounts(nextCounts);
      setModules(nextModules);
      setDetailsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [professors]);

  const globalStep = useMemo(
    () => computeGlobalNextStep(professors, scores, documentCounts, modules),
    [professors, scores, documentCounts, modules]
  );

  return (
    <div>
      <PageHeader
        title="Minhas matérias"
        action={
          // Secundária de propósito: a cápsula principal da tela é a do cartão
          // de hoje. Se as duas fossem cheias, nenhuma seria o caminho.
          <Link href="/professor/novo" className={capsuleVariants("secundaria")}>
            <Plus className="h-[18px] w-[18px]" />
            Novo professor
          </Link>
        }
      />

      {/*
        44 · Carregando as matérias. O título e o rótulo de seção já saíram de
        verdade (ficam fora deste bloco); aqui pulsa só o que vem da API, nas
        mesmas caixas e na mesma altura do conteúdo final — é isso que impede a
        tela de pular quando o dado chega.
      */}
      {loading && (
        <div className="space-y-6">
          <GlassCard nivel="hud" radius="grupo" className="flex items-center gap-6 px-6 py-5">
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-9 w-9 rounded-capsula" />
              <div className="space-y-1.5">
                <SkeletonLinha className="w-16" />
                <SkeletonLinha className="h-2.5 w-12" />
              </div>
            </div>
            <span aria-hidden className="h-8 w-[0.5px] bg-borda" />
            <div className="flex-1 space-y-2">
              <SkeletonLinha className="w-20" />
              <Skeleton className="h-1.5 w-full" />
            </div>
          </GlassCard>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <GlassCard nivel="cartao" radius="grupo" className="space-y-3 p-6 lg:col-span-2">
              <SkeletonLinha className="h-2.5 w-12" />
              <SkeletonLinha className="h-5 w-3/4" />
              <SkeletonLinha className="w-1/2" />
              <Skeleton className="mt-4 h-capsula-principal w-full rounded-capsula" />
            </GlassCard>
            <Skeleton className="h-52 rounded-grupo" />
          </div>

          <div>
            <p className="mb-2 px-rotulo-secao text-rotulo uppercase text-tinta-fraca">
              Suas matérias
            </p>
            <InsetList>
              {[0, 1, 2].map((i) => (
                <div key={i} className="relative flex min-h-[64px] items-center gap-3 px-4 py-3">
                  <Skeleton className="h-2.5 w-2.5 flex-none rounded-capsula" />
                  <div className="flex-1 space-y-1.5">
                    <SkeletonLinha className="w-1/3" />
                    <SkeletonLinha className="h-2.5 w-1/2" />
                  </div>
                  {i < 2 && (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute bottom-0 left-[38px] right-0 h-[0.5px] bg-borda"
                    />
                  )}
                </div>
              ))}
            </InsetList>
          </div>
        </div>
      )}

      {!loading && error && (
        <InlineAlert>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            <Capsule variant="secundaria" onClick={load}>
              Tentar novamente
            </Capsule>
          </div>
        </InlineAlert>
      )}

      {!loading && !error && professors.length === 0 && (
        <EmptyState
          icon={GraduationCap}
          title="Comece pela matéria que mais te preocupa"
          description="Crie um professor, suba o material dele, e ele passa a estudar com você."
          action={
            <Link href="/comecar" className={capsuleVariants("principal")}>
              <Plus className="h-[18px] w-[18px]" />
              Criar professor
            </Link>
          }
        />
      )}

      {!loading && !error && professors.length > 0 && (
        <div className="space-y-6">
          <ProgressStrip progress={progress} loading={progressLoading} />

          {/* Próximo passo e mini-calendário lado a lado no desktop; empilhados
              no celular (o "o que fazer hoje" vem primeiro de propósito). */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              {detailsLoading ? (
                <Skeleton className="h-52 rounded-grupo" />
              ) : (
                globalStep && <TodayCard globalStep={globalStep} />
              )}
            </div>
            <MiniCalendar />
          </div>

          <InsetList label="Suas matérias">
            {professors.map((p) => {
              const score = scores[p.id];
              const temDados = score && score.topics.length > 0;

              return (
                <MateriaRow
                  key={p.id}
                  id={p.id}
                  nome={p.name}
                  disciplina={p.discipline}
                  // Enquanto os detalhes carregam, a linha aparece só com nome e
                  // disciplina: os dois já vieram da primeira chamada e são o
                  // que o usuário usa pra escolher. Skeleton aqui faria a lista
                  // pular de altura quando as pílulas chegassem.
                  dominioPct={temDados ? score.overall_mastery_pct : null}
                  streakDias={score?.streak_days ?? 0}
                  semMaterial={documentCounts[p.id] === 0}
                />
              );
            })}
          </InsetList>
        </div>
      )}
    </div>
  );
}
