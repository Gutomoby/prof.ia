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
import { Skeleton } from "@/components/ui/skeleton";
import { MateriaRow } from "@/components/professor/MateriaRow";
import { ProgressStrip } from "@/components/progress/ProgressStrip";
import { TodayCard } from "@/components/progress/TodayCard";
import { MiniCalendar } from "@/components/progress/MiniCalendar";
import { computeGlobalNextStep } from "@/lib/global-next-step";
import type { ProfessorListItem, ScoreSummary, UserProgress } from "@/lib/types";

export default function EstudarPage() {
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
        title="Estudar"
        action={
          // Secundária de propósito: a cápsula principal da tela é a do cartão
          // de hoje. Se as duas fossem cheias, nenhuma seria o caminho.
          <Link href="/professor/novo" className={capsuleVariants("secundaria")}>
            <Plus className="h-[18px] w-[18px]" />
            Novo professor
          </Link>
        }
      />

      {loading && (
        <div className="space-y-6">
          <Skeleton className="h-[92px] rounded-grupo" />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Skeleton className="h-52 rounded-grupo lg:col-span-2" />
            <Skeleton className="h-52 rounded-grupo" />
          </div>
          <Skeleton className="h-40 rounded-grupo" />
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
            <Link href="/professor/novo" className={capsuleVariants("principal")}>
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
