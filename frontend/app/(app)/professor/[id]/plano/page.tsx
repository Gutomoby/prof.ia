"use client";

import { useEffect, useState } from "react";
import { CalendarDays, RotateCcw, Sparkles, Target } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Capsule } from "@/components/ui/capsule";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineAlert } from "@/components/ui/inline-alert";
import { InsetList } from "@/components/ui/inset-list";
import { MetricText } from "@/components/ui/metric-text";
import { Skeleton } from "@/components/ui/skeleton";
import { MathText } from "@/components/ui/math-text";
import { useSetHeaderAction } from "@/components/layout/HeaderActionContext";
import { cn, idadeRelativa } from "@/lib/utils";
import type { StudyPlan } from "@/lib/types";

/*
  Tela 31 · Plano de estudos.

  Rota própria porque o desenho a trata assim — o voltar dela diz "Progresso",
  não "Prof. Atuária". Antes ela era um cartão no fim da aba Progresso.

  StudyPlanContent já entrega exatamente as quatro partes que a tela mostra:
  resumo, prioridades, semana e mês. Nada de backend novo aqui.
*/

/** "há 2 dias" — a idade do plano importa mais que a data exata. */
const idade = idadeRelativa;

function PassoNumerado({ n, texto, ultimo }: { n: number; texto: string; ultimo: boolean }) {
  return (
    <div className="relative flex items-start gap-3 px-4 py-3.5">
      <span className="mt-0.5 flex h-[26px] w-[26px] flex-none items-center justify-center rounded-capsula bg-indigo text-[13px] font-semibold text-papel">
        <MetricText weight="semibold">{n}</MetricText>
      </span>
      <MathText className="flex-1 text-pretty text-[16px] leading-[1.35] tracking-[-0.43px]">
        {texto}
      </MathText>
      {!ultimo && (
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-[54px] right-0 h-[0.5px] bg-borda"
        />
      )}
    </div>
  );
}

function PassoDoMes({
  icone,
  texto,
  ultimo,
}: {
  icone: React.ReactNode;
  texto: string;
  ultimo: boolean;
}) {
  return (
    <div className="relative flex items-start gap-3 px-4 py-3.5">
      <span className="mt-0.5 flex h-[26px] w-[26px] flex-none items-center justify-center text-tinta-fraca [&>svg]:h-[19px] [&>svg]:w-[19px]">
        {icone}
      </span>
      <MathText className="flex-1 text-pretty text-[16px] leading-[1.35] tracking-[-0.43px]">
        {texto}
      </MathText>
      {!ultimo && (
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-[54px] right-0 h-[0.5px] bg-borda"
        />
      )}
    </div>
  );
}

export default function PlanoPage({ params }: { params: { id: string } }) {
  const professorId = params.id;

  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const [erroGerar, setErroGerar] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      setPlan(await api.getStudyPlan(professorId));
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Não foi possível carregar o plano.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professorId]);

  async function gerar() {
    setErroGerar(null);
    setGerando(true);
    try {
      setPlan(await api.generateStudyPlan(professorId));
    } catch (err) {
      setErroGerar(err instanceof ApiError ? err.message : "Falha ao montar o plano.");
    } finally {
      setGerando(false);
    }
  }

  // Recarregar o plano é a ação da tela, e o handoff a põe no canto como ícone.
  useSetHeaderAction(
    plan ? (
      <button
        type="button"
        onClick={gerar}
        disabled={gerando}
        aria-label="Atualizar o plano"
        title="Atualizar o plano"
        className="-mr-2 flex h-toque w-toque flex-none items-center justify-center rounded-capsula text-indigo transition-colors duration-140 ease-out hover:bg-indigo/6 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte"
      >
        <RotateCcw className={cn("h-5 w-5", gerando && "animate-spin")} />
      </button>
    ) : null,
    [plan, gerando]
  );

  if (loading) {
    return (
      <div className="mx-auto flex max-w-[560px] flex-col gap-4">
        <Skeleton className="h-[120px] rounded-cartao" />
        <Skeleton className="h-[160px] rounded-grupo" />
      </div>
    );
  }

  if (loadError) {
    return (
      <InlineAlert>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>{loadError}</span>
          <Capsule variant="secundaria" onClick={load}>
            Tentar novamente
          </Capsule>
        </div>
      </InlineAlert>
    );
  }

  if (!plan) {
    return (
      <div className="mx-auto max-w-[560px]">
        <EmptyState
          kango="lendo"
          title="Nenhum plano ainda"
          description="O Kango monta um plano a partir do seu material e dos tópicos em que você mais erra."
          action={
            <Capsule loading={gerando} onClick={gerar}>
              <Sparkles className="h-[17px] w-[17px]" />
              {gerando ? "Montando..." : "Montar o plano"}
            </Capsule>
          }
        />
        {erroGerar && <InlineAlert>{erroGerar}</InlineAlert>}
      </div>
    );
  }

  const { resumo, prioridades, semana, mes } = plan.content;

  return (
    <div className="mx-auto flex max-w-[560px] flex-col">
      <p className="-mt-2 flex items-center gap-1.5 text-[14px] text-tinta-fraca">
        <Sparkles className="h-4 w-4 flex-none text-indigo" />
        Feito pelo Kango com o seu material · {idade(plan.created_at)}
      </p>

      {/* Resumo em tonal índigo: é a leitura do Kango, não um dado da matéria. */}
      <div className="mt-4 rounded-cartao bg-indigo/8 p-4">
        <MathText as="p" className="text-pretty text-[16px] leading-[1.5] text-tinta">
          {resumo}
        </MathText>
      </div>

      {prioridades.length > 0 && (
        <>
          <p className="mb-2 mt-[22px] px-rotulo-secao text-rotulo uppercase text-erro">
            Prioridade agora
          </p>
          <div className="flex flex-wrap gap-2 px-rotulo-secao">
            {prioridades.map((p, i) => (
              <span
                key={p}
                className={cn(
                  "rounded-capsula px-[11px] py-1.5 text-nota font-medium",
                  // As duas primeiras são o gargalo de verdade; da terceira em
                  // diante é fila, não urgência.
                  i < 2 ? "bg-erro/10 text-erro" : "bg-cinza-tonal text-tinta-fraca"
                )}
              >
                <MathText>{p}</MathText>
              </span>
            ))}
          </div>
        </>
      )}

      {semana.length > 0 && (
        <>
          <p className="mb-2 mt-[22px] px-rotulo-secao text-rotulo uppercase text-tinta-fraca">
            Esta semana
          </p>
          <InsetList>
            {semana.map((item, i) => (
              <PassoNumerado key={i} n={i + 1} texto={item} ultimo={i === semana.length - 1} />
            ))}
          </InsetList>
        </>
      )}

      {mes.length > 0 && (
        <>
          <p className="mb-2 mt-[22px] px-rotulo-secao text-rotulo uppercase text-tinta-fraca">
            Este mês
          </p>
          <InsetList>
            {mes.map((item, i) => (
              <PassoDoMes
                key={i}
                icone={i === 0 ? <Target /> : <CalendarDays />}
                texto={item}
                ultimo={i === mes.length - 1}
              />
            ))}
          </InsetList>
        </>
      )}

      {erroGerar && (
        <div className="mt-4">
          <InlineAlert>{erroGerar}</InlineAlert>
        </div>
      )}

      <Capsule variant="secundaria" block className="mt-6" loading={gerando} onClick={gerar}>
        {!gerando && <RotateCcw className="h-4 w-4" />}
        {gerando ? "Montando..." : "Atualizar o plano"}
      </Capsule>
    </div>
  );
}
