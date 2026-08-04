"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, FileText, Flame, GraduationCap, Play, Plus, Type } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Capsule, capsuleVariants } from "@/components/ui/capsule";
import { EmptyState } from "@/components/ui/empty-state";
import { Gauge, ProgressBar } from "@/components/ui/gauge";
import { GlassCard } from "@/components/ui/glass-card";
import { InlineAlert } from "@/components/ui/inline-alert";
import { InsetList, InsetRow } from "@/components/ui/inset-list";
import { KangoPlaceholder } from "@/components/ui/kango-placeholder";
import { MetricText, toneDaNota } from "@/components/ui/metric-text";
import { Pill, tonePilulaDaNota } from "@/components/ui/pill";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { computeNextStep } from "@/lib/next-step";
import { professorColor } from "@/lib/professor-color";
import { useStartQuiz } from "@/lib/use-start-quiz";
import { cn, pctInteiro } from "@/lib/utils";
import type {
  ActivityHistoryItem,
  DocumentItem,
  ProfessorListItem,
  ScoreSummary,
  UserProgress,
} from "@/lib/types";

/*
  Tela 20 · Estudar (home diária).

  É a home da aba Estudar. A lista completa de matérias mora em /materias
  (tela 14) — as duas aparecem no handoff com "Estudar" ativo na barra, e as
  legendas as separam: a 14 está no grupo de começar/criar a matéria, a 20 é
  "a home diária".

  O cabeçalho é montado aqui em vez de usar PageHeader porque nesta tela a
  linha da matéria vem ACIMA do large title, e o PageHeader só sabe pôr
  subtítulo abaixo.

  Sobre "5 questões · 3 min · +40 XP" do desenho: a contagem exata não existe
  antes de gerar. routers/atividades.py pede "5 a 8 questões" ao modelo e quem
  decide é ele, então a tela mostra a faixa. Os minutos ficariam por conta da
  imaginação e ficaram de fora.
*/

const QUESTOES_POR_LICAO = "5 a 8";

function ChipMateria({
  professor,
  ativo,
  onClick,
}: {
  professor: ProfessorListItem;
  ativo: boolean;
  onClick: () => void;
}) {
  const cor = professorColor(professor.id);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={cn(
        "flex h-8 flex-none items-center gap-[7px] rounded-capsula px-3 text-nota",
        "transition-colors duration-140 ease-out",
        "focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte",
        ativo
          ? "bg-indigo/10 font-semibold text-tinta"
          : "vidro-abas font-medium text-tinta-fraca hover:bg-white/90"
      )}
    >
      <span aria-hidden className={cn("h-[7px] w-[7px] flex-none rounded-capsula", cor.bg)} />
      <span className="max-w-[9rem] truncate">{professor.name}</span>
    </button>
  );
}

export default function EstudarPage() {
  const [professors, setProfessors] = useState<ProfessorListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [scores, setScores] = useState<Record<string, ScoreSummary>>({});
  const [docs, setDocs] = useState<Record<string, DocumentItem[]>>({});
  const [detailsLoading, setDetailsLoading] = useState(true);

  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [aba, setAba] = useState<"trilha" | "revisao" | "material">("trilha");
  const [revisoes, setRevisoes] = useState<ActivityHistoryItem[]>([]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listProfessors();
      setProfessors(res.items);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar suas matérias. O backend está no ar?"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    api.getProgress().then(setProgress).catch(() => setProgress(null));
  }, []);

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
          ([score, lista]) => ({ id: p.id, score, docs: lista.items })
        )
      )
    ).then((results) => {
      if (cancelled) return;
      const nextScores: Record<string, ScoreSummary> = {};
      const nextDocs: Record<string, DocumentItem[]> = {};
      results.forEach((res) => {
        if (res.status === "fulfilled") {
          nextScores[res.value.id] = res.value.score;
          nextDocs[res.value.id] = res.value.docs;
        }
      });
      setScores(nextScores);
      setDocs(nextDocs);
      setDetailsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [professors]);

  // A matéria em foco é a primeira até o usuário escolher outra. Trocar de
  // matéria volta para a Trilha: as outras abas mostram dado da anterior por um
  // instante se a aba ficar de pé.
  const selecionada = useMemo(
    () => professors.find((p) => p.id === selectedId) ?? professors[0] ?? null,
    [professors, selectedId]
  );

  useEffect(() => {
    if (!selecionada || aba !== "revisao") return;
    let cancelled = false;
    api
      .listAtividades(selecionada.id)
      .then((res) => !cancelled && setRevisoes(res.items))
      .catch(() => !cancelled && setRevisoes([]));
    return () => {
      cancelled = true;
    };
  }, [selecionada, aba]);

  const { start, generating, error: startError } = useStartQuiz(selecionada?.id ?? "");

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-12 w-48 rounded-chip" />
        <Skeleton className="h-8 rounded-capsula" />
        <Skeleton className="h-[220px] rounded-grupo" />
      </div>
    );
  }

  if (error) {
    return (
      <InlineAlert>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>{error}</span>
          <Capsule variant="secundaria" onClick={load}>
            Tentar novamente
          </Capsule>
        </div>
      </InlineAlert>
    );
  }

  // 12 · Sem matéria ainda.
  if (professors.length === 0 || !selecionada) {
    return (
      <EmptyState
        kango="acenando"
        title="Comece pela matéria que mais te preocupa"
        description="Crie um professor, suba o material dele, e ele passa a estudar com você."
        action={
          <Link href="/professor/novo" className={capsuleVariants("principal")}>
            <Plus className="h-[18px] w-[18px]" />
            Criar professor
          </Link>
        }
      />
    );
  }

  const score = scores[selecionada.id];
  const material = docs[selecionada.id] ?? [];
  const step = computeNextStep({
    hasDocuments: material.length > 0,
    topics: score?.topics ?? [],
  });
  const dominio = score ? pctInteiro(score.overall_mastery_pct) : 0;

  const licoes = progress?.licoes_hoje ?? 0;
  const metaLicoes = progress?.meta_licoes ?? 2;
  const faltam = Math.max(0, metaLicoes - licoes);

  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-4">
      {/* Cabeçalho: matéria em foco acima, large title abaixo, sequência à direita. */}
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-[7px] text-nota font-semibold text-tinta-fraca">
            <span
              aria-hidden
              className={cn("h-2 w-2 flex-none rounded-capsula", professorColor(selecionada.id).bg)}
            />
            <span className="truncate">{selecionada.discipline}</span>
          </p>
          <h1 className="mt-0.5 text-titulo-grande text-tinta">Estudar</h1>
        </div>

        <div className="flex flex-none items-center gap-2">
          {progress && (
            <span className="flex h-[38px] items-center gap-1.5 rounded-capsula px-3 vidro-hud shadow-hairline">
              <Flame
                className={cn(
                  "h-[15px] w-[15px]",
                  progress.current_streak > 0 ? "text-acerto" : "text-tinta-fraca"
                )}
              />
              <MetricText weight="bold" className="text-[14px]">
                {progress.current_streak}
              </MetricText>
            </span>
          )}
          <Link
            href="/materias"
            aria-label="Minhas matérias"
            className="flex h-[38px] items-center gap-1.5 rounded-capsula bg-white px-3 text-nota font-semibold text-indigo shadow-capsula-secundaria"
          >
            <GraduationCap className="h-[15px] w-[15px]" />
            Matérias
          </Link>
        </div>
      </div>

      {/* Chips: trocam a matéria em foco sem sair da home. */}
      {professors.length > 1 && (
        <div className="-mx-margem flex gap-2 overflow-x-auto px-margem pb-0.5">
          {professors.map((p) => (
            <ChipMateria
              key={p.id}
              professor={p}
              ativo={p.id === selecionada.id}
              onClick={() => {
                setSelectedId(p.id);
                setAba("trilha");
              }}
            />
          ))}
        </div>
      )}

      <Segmented
        aria-label={`Seções de ${selecionada.name}`}
        value={aba}
        onValueChange={(v) => setAba(v as typeof aba)}
        options={[
          { value: "trilha", label: "Trilha" },
          { value: "revisao", label: "Revisão" },
          { value: "material", label: "Material" },
        ]}
      />

      {aba === "trilha" &&
        (detailsLoading ? (
          <Skeleton className="h-[220px] rounded-grupo" />
        ) : (
          <GlassCard nivel="cartao" radius="grupo" className="p-4">
            <div className="flex items-center gap-4">
              <Gauge value={dominio} size="cartao" tone="nota" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-tinta-fraca">
                  {step.kind === "revisar-topico" ? "Continuar de onde parou" : "Comece por aqui"}
                </p>
                <p className="mt-[3px] text-titulo-cartao text-tinta">{step.title}</p>
                {step.kind !== "subir-material" && (
                  <p className="mt-1 text-nota text-tinta-fraca">
                    <MetricText tone="fraca">{QUESTOES_POR_LICAO}</MetricText> questões
                  </p>
                )}
              </div>
            </div>

            {startError && (
              <div className="mt-3">
                <InlineAlert>{startError}</InlineAlert>
              </div>
            )}

            <div className="mt-4">
              {step.kind === "subir-material" ? (
                <Link
                  href={`/professor/${selecionada.id}/configurar`}
                  className={capsuleVariants("principal", true)}
                >
                  {step.ctaLabel}
                  <ChevronRight className="h-[18px] w-[18px]" />
                </Link>
              ) : (
                <Capsule block loading={generating} onClick={() => start(step.topic)}>
                  {!generating && <Play className="h-4 w-4 fill-papel" />}
                  {generating ? "Gerando..." : "Começar lição"}
                </Capsule>
              )}
            </div>
          </GlassCard>
        ))}

      {aba === "revisao" &&
        (revisoes.length === 0 ? (
          <p className="px-rotulo-secao text-nota text-tinta-fraca">
            Nenhuma lição respondida nesta matéria ainda.
          </p>
        ) : (
          <InsetList>
            {revisoes.slice(0, 6).map((a) => (
              <InsetRow
                key={a.id}
                href={`/professor/${selecionada.id}/quiz/historico/${a.id}`}
                title={a.topic ?? "Quiz geral"}
                subtitle={new Date(a.created_at).toLocaleDateString("pt-BR")}
                value={
                  a.score_pct === null ? undefined : (
                    <Pill tone={tonePilulaDaNota(pctInteiro(a.score_pct))}>
                      <MetricText>{pctInteiro(a.score_pct)}%</MetricText>
                    </Pill>
                  )
                }
                trailing={<ChevronRight className="h-[18px] w-[18px]" />}
              />
            ))}
          </InsetList>
        ))}

      {aba === "material" &&
        (material.length === 0 ? (
          <p className="px-rotulo-secao text-nota text-tinta-fraca">
            O Kango ainda não leu nada desta matéria.
          </p>
        ) : (
          <InsetList>
            {material.map((doc) => (
              <InsetRow
                key={doc.id}
                href={`/professor/${selecionada.id}/configurar`}
                icon={doc.type === "pdf" ? <FileText /> : <Type />}
                iconVariant="simples"
                title={doc.name}
                value={
                  <MetricText className="text-nota" tone="fraca">
                    {new Date(doc.created_at).toLocaleDateString("pt-BR")}
                  </MetricText>
                }
              />
            ))}
          </InsetList>
        ))}

      {/* Meta do dia e a fala do Kango, lado a lado. */}
      <div className="flex gap-3">
        <GlassCard nivel="hud" radius="cartao" className="flex-1 px-4 py-3.5">
          <p className="text-[12px] font-semibold text-tinta-fraca">Meta de hoje</p>
          <p className="mt-1 text-[20px] font-bold leading-tight text-tinta">
            <MetricText weight="bold">{licoes}</MetricText> de{" "}
            <MetricText weight="bold">{metaLicoes}</MetricText>{" "}
            <span className="text-linha font-semibold">
              {metaLicoes === 1 ? "lição" : "lições"}
            </span>
          </p>
          <ProgressBar
            className="mt-[7px]"
            espessura="meta"
            tone="acerto"
            value={(licoes / metaLicoes) * 100}
            aria-label={`${licoes} de ${metaLicoes} lições hoje`}
          />
        </GlassCard>

        <GlassCard nivel="hud" radius="cartao" className="flex flex-1 items-center gap-3 px-4 py-3.5">
          <KangoPlaceholder px={40} />
          <p className="min-w-0 text-nota leading-[1.35] text-tinta-fraca">
            {/* O verbo concorda junto com o substantivo: "Falta 1 lição", mas
                "Faltam 2 lições". A copy da tela 20 só mostra o singular. */}
            {faltam === 0
              ? '"Meta do dia fechada. Sequência viva."'
              : faltam === 1
                ? '"Falta 1 lição pra fechar o dia."'
                : `"Faltam ${faltam} lições pra fechar o dia."`}
          </p>
        </GlassCard>
      </div>
    </div>
  );
}
