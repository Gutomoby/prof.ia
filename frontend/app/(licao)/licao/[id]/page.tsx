"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Capsule } from "@/components/ui/capsule";
import { InlineAlert } from "@/components/ui/inline-alert";
import { InsetList, InsetRow } from "@/components/ui/inset-list";
import { KangoPlaceholder } from "@/components/ui/kango-placeholder";
import { MetricText } from "@/components/ui/metric-text";
import { ProgressBar } from "@/components/ui/gauge";
import { Licao } from "@/components/quiz/Licao";
import { ResultadoLicao } from "@/components/quiz/ResultadoLicao";
import type { ActivitySubmitResult, Difficulty, GeneratedActivity } from "@/lib/types";

/*
  A lição inteira, em tela cheia: gerar (tela 23), responder (37/38) e o
  resultado (39). Mora fora da casca do app — ver (licao)/layout.tsx.

  O que gerar vem da URL: ?topic=, ?module=, ?dif=. Ficar na URL em vez de em
  sessionStorage tem um efeito que vale a pena — recarregar a página gera uma
  lição nova do mesmo escopo, em vez de cair numa tela vazia.
*/

type Fase = "gerando" | "respondendo" | "resultado";

export default function LicaoPage({ params }: { params: { id: string } }) {
  const professorId = params.id;
  const router = useRouter();
  const search = useSearchParams();

  const topic = search.get("topic");
  const moduleId = search.get("module");
  const dificuldade = (search.get("dif") as Difficulty | null) ?? "medio";
  const rotulo = search.get("rotulo") ?? topic;

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
      const gerada = await api.generateAtividade({
        professor_id: professorId,
        topic: topic || null,
        module_id: moduleId || null,
        difficulty: dificuldade,
      });
      setActivity(gerada);
      setStartedAt(Date.now());
      setFase("respondendo");
    } catch (err) {
      setErroGeracao(err instanceof ApiError ? err.message : "Falha ao gerar a lição.");
    }
  }, [professorId, topic, moduleId, dificuldade]);

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
      setErroEnvio(err instanceof ApiError ? err.message : "Falha ao enviar as respostas.");
    } finally {
      setEnviando(false);
    }
  }

  function sair() {
    router.push(`/professor/${professorId}`);
  }

  // 23 · Gerando o quiz.
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
              <KangoPlaceholder px={132} estado="confuso" tom="neutro" />
              <h1 className="mt-6 text-pretty text-[28px] font-bold leading-[34px] tracking-[-0.02em] text-tinta">
                Não deu para montar a lição
              </h1>
              <p className="mt-2 max-w-[34ch] text-pretty text-corpo text-tinta-fraca">
                {erroGeracao}
              </p>
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
              <KangoPlaceholder px={132} estado="folheando o material" />
              <h1 className="mt-6 text-pretty text-[28px] font-bold leading-[34px] tracking-[-0.02em] text-tinta">
                {rotulo ? <>Montando seu quiz de {rotulo}</> : "Montando seu quiz"}
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
                    <InsetRow
                      key={passo}
                      title={<span className="text-tinta-fraca">{passo}</span>}
                    />
                  ))}
                </InsetList>
              </div>

              <ProgressBar
                className="mt-4 w-full animate-pulse"
                value={100}
                aria-label="Gerando a lição"
              />
              <p className="mt-2.5 text-nota text-tinta-fraca">
                As questões saem só do material que você enviou.
              </p>
            </>
          )}
        </div>

        {/* O texto vai dentro de um span: num flex, cada nó de texto solto
            vira item e a frase se parte em colunas. */}
        {!erroGeracao && (
          <div className="flex items-center gap-3 pt-8 text-left">
            <Sparkles className="h-[17px] w-[17px] flex-none text-acerto" />
            <span className="text-nota leading-[1.4] text-tinta-fraca">
              Dica: acertar <MetricText tone="fraca">70%</MetricText> de um tópico duas vezes marca
              ele como dominado.
            </span>
          </div>
        )}
      </div>
    );
  }

  // 37 e 38 · a lição.
  if (fase === "respondendo" && activity) {
    return (
      <Licao
        activity={activity}
        enviando={enviando}
        erroEnvio={erroEnvio}
        onSair={sair}
        onConcluir={concluir}
      />
    );
  }

  // 39 · resultado.
  if (fase === "resultado" && result) {
    return (
      <ResultadoLicao
        result={result}
        topico={activity?.topic ?? null}
        professorId={professorId}
        gerando={false}
        erro={null}
        onRepetir={gerar}
      />
    );
  }

  return <InlineAlert>Não foi possível carregar a lição.</InlineAlert>;
}
