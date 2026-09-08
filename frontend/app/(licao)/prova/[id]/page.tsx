"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RotateCcw, Sparkles } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Capsule, capsuleVariants } from "@/components/ui/capsule";
import { InlineAlert } from "@/components/ui/inline-alert";
import { InsetList } from "@/components/ui/inset-list";
import { Kango } from "@/components/ui/kango";
import { MetricText } from "@/components/ui/metric-text";
import { Prova } from "@/components/quiz/Prova";
import { QuizReview } from "@/components/quiz/QuizReview";
import type { ActivitySubmitResult, GeneratedActivity } from "@/lib/types";

/*
  A prova inteira, em tela cheia: gerar, responder e o resultado — mesmo
  esqueleto de fases de licao/[id]/page.tsx, mas com o componente Prova (sem
  correção por questão) em vez de Licao, e sem topic/module na URL: prova é
  sempre a trilha inteira, não um recorte.

  O resultado usa QuizReview (a mesma tela de revisão do histórico de quiz),
  não ResultadoLicao: numa prova o aluno NUNCA viu o gabarito durante a
  tentativa, então a lista de questões erradas com explicação é o resultado
  em si, não um detalhe opcional pra revisitar depois.
*/

type Fase = "gerando" | "respondendo" | "resultado";

export default function ProvaPage({ params }: { params: { id: string } }) {
  const professorId = params.id;
  const router = useRouter();

  const [fase, setFase] = useState<Fase>("gerando");
  const [activity, setActivity] = useState<GeneratedActivity | null>(null);
  const [result, setResult] = useState<ActivitySubmitResult | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const [erroGeracao, setErroGeracao] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);

  // StrictMode monta o efeito duas vezes em dev, e cada geração custa uma
  // chamada ao modelo. O ref garante uma só.
  const jaGerou = useRef(false);

  const gerar = useCallback(async () => {
    setErroGeracao(null);
    setResult(null);
    setFase("gerando");
    try {
      const gerada = await api.generateProva({ professor_id: professorId });
      setActivity(gerada);
      setStartedAt(Date.now());
      setFase("respondendo");
    } catch (err) {
      setErroGeracao(err instanceof ApiError ? err.message : "Falha ao gerar a prova.");
    }
  }, [professorId]);

  useEffect(() => {
    if (jaGerou.current) return;
    jaGerou.current = true;
    gerar();
  }, [gerar]);

  async function concluir(respostas: Record<string, number>) {
    if (!activity) return;
    setErroEnvio(null);
    setEnviando(true);
    try {
      const res = await api.submitAtividade({
        activity_id: activity.activity_id,
        answers: respostas,
        time_seconds: startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0,
      });
      setResult(res);
      setFase("resultado");
    } catch (err) {
      setErroEnvio(err instanceof ApiError ? err.message : "Falha ao enviar a prova.");
    } finally {
      setEnviando(false);
    }
  }

  function sair() {
    router.push(`/professor/${professorId}`);
  }

  if (fase === "gerando") {
    return (
      <div className="mx-auto flex min-h-[80vh] max-w-[520px] flex-col items-center text-center">
        <div className="flex w-full justify-end">
          <button
            type="button"
            onClick={sair}
            className="rounded-chip px-2 py-1 text-[17px] font-medium text-indigo hover:bg-indigo/6 focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte"
          >
            Cancelar
          </button>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center">
          {erroGeracao ? (
            <>
              <Kango px={132} estado="confuso" tom="neutro" />
              <h1 className="mt-6 text-pretty text-[28px] font-bold leading-[34px] tracking-[-0.02em] text-tinta">
                Não deu para montar a prova
              </h1>
              <p className="mt-2 max-w-[34ch] text-pretty text-corpo text-tinta-fraca">{erroGeracao}</p>
              <div className="mt-6 w-full">
                <Capsule block onClick={gerar}>
                  Tentar de novo
                </Capsule>
                <Capsule variant="texto" block className="mt-2" onClick={sair}>
                  Voltar à matéria
                </Capsule>
              </div>
            </>
          ) : (
            <>
              <Kango px={132} estado="folheando o material" />
              <h1 className="mt-6 text-pretty text-[28px] font-bold leading-[34px] tracking-[-0.02em] text-tinta">
                Montando sua prova
              </h1>
              <p className="mt-2 text-corpo text-tinta-fraca">
                Cobrindo a matéria inteira — leva uns <MetricText tone="fraca">20</MetricText> segundos.
              </p>

              <div className="mt-6 w-full">
                <InsetList>
                  {[
                    "Reunir material de todos os capítulos",
                    "Escrever as questões",
                    "Conferir as respostas",
                  ].map((passo, i) => (
                    <div key={passo} className="relative min-h-linha overflow-hidden">
                      <div className="flex min-h-linha items-center px-4">
                        <span className="text-linha text-tinta-fraca">{passo}</span>
                      </div>
                      <span
                        aria-hidden
                        className="movimento-essencial pointer-events-none absolute inset-y-0 -inset-x-full animate-brilho bg-gradient-to-r from-transparent via-white/70 to-transparent"
                        style={{ animationDelay: `${i * 0.45}s` }}
                      />
                      {i < 2 && (
                        <span
                          aria-hidden
                          className="pointer-events-none absolute bottom-0 left-4 right-0 h-[0.5px] bg-borda"
                        />
                      )}
                    </div>
                  ))}
                </InsetList>
              </div>

              <div
                role="progressbar"
                aria-label="Gerando a prova"
                className="relative mt-4 h-2 w-full overflow-hidden rounded-capsula bg-cinza-tonal"
              >
                <span
                  aria-hidden
                  className="movimento-essencial absolute inset-y-0 left-0 w-1/4 animate-indeterminada rounded-capsula bg-indigo"
                />
              </div>
              <p className="mt-2.5 text-nota text-tinta-fraca">
                As questões saem só do material que você enviou.
              </p>
            </>
          )}
        </div>

        {!erroGeracao && (
          <div className="flex items-center gap-3 pt-8 text-left">
            <Sparkles className="h-[17px] w-[17px] flex-none text-acerto" />
            <span className="text-nota leading-[1.4] text-tinta-fraca">
              A correção só aparece depois que você enviar a prova toda — como numa prova de verdade.
            </span>
          </div>
        )}
      </div>
    );
  }

  if (fase === "respondendo" && activity) {
    return (
      <Prova
        activity={activity}
        enviando={enviando}
        erroEnvio={erroEnvio}
        onSair={sair}
        onConcluir={concluir}
      />
    );
  }

  if (fase === "resultado" && result) {
    return (
      <div className="mx-auto w-full max-w-[560px] md:max-w-none">
        <p className="-mt-2 mb-4 text-[14px] text-tinta-fraca">Prova geral concluída</p>
        <QuizReview
          scorePct={result.score_pct}
          questions={result.questions}
          xpGanho={result.xp_ganho}
          topicosDominados={result.topicos_dominados}
          footer={
            <div className="mt-2 flex flex-col gap-3 md:flex-row-reverse md:items-center">
              <Capsule block onClick={gerar} className="md:flex-1">
                <RotateCcw className="h-4 w-4" />
                Fazer outra prova
              </Capsule>
              <Link
                href={`/professor/${professorId}`}
                className={capsuleVariants("texto", true, "md:w-auto md:flex-none md:px-6")}
              >
                Voltar à trilha
              </Link>
            </div>
          }
        />
      </div>
    );
  }

  return <InlineAlert>Não foi possível carregar a prova.</InlineAlert>;
}
