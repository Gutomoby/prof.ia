"use client";

import { useState } from "react";
import { Flame, Info, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Capsule } from "@/components/ui/capsule";
import { InlineAlert } from "@/components/ui/inline-alert";
import { InsetList } from "@/components/ui/inset-list";
import { KangoPlaceholder } from "@/components/ui/kango-placeholder";
import { MetricText } from "@/components/ui/metric-text";
import { ProgressBar } from "@/components/ui/gauge";
import { QuizOption } from "@/components/quiz/QuizOption";
import { cn } from "@/lib/utils";
import type { GeneratedActivity, QuestionCheckResult } from "@/lib/types";

/*
  Telas 37 e 38 · a lição, uma questão por vez.

  O app respondia tudo de uma vez e corrigia no fim. O desenho corrige NO ATO,
  e essa diferença não é de layout: exige saber o gabarito antes de fechar a
  atividade. O gabarito não vem na geração de propósito (_strip_answers no
  backend), senão o quiz inteiro viajaria com as respostas.

  Daí o POST /atividades/conferir, criado para isto: devolve o gabarito de UMA
  questão, já respondida, sem escrever nada. O score, o XP e a sequência
  continuam saindo de /submeter no fim — uma lição abandonada no meio não vira
  tentativa pontuada.

  O combo é contado no cliente: ActivitySubmitResult não o traz, e ele é
  derivável de acertos seguidos. Sequência de acertos NÃO é vida — errar não
  custa nada, só zera a contagem (handoff §10).
*/

interface Resposta {
  escolha: number;
  resultado: QuestionCheckResult;
}

export function Licao({
  activity,
  onSair,
  onConcluir,
  enviando,
  erroEnvio,
}: {
  activity: GeneratedActivity;
  onSair: () => void;
  onConcluir: (respostas: Record<string, number>) => void;
  enviando: boolean;
  erroEnvio: string | null;
}) {
  const [indice, setIndice] = useState(0);
  const [respostas, setRespostas] = useState<Record<number, Resposta>>({});
  const [escolha, setEscolha] = useState<number | null>(null);
  const [conferindo, setConferindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const total = activity.questions.length;
  const questao = activity.questions[indice];
  const respondida = respostas[indice];
  const ultima = indice === total - 1;

  // Combo: acertos seguidos até a questão atual, contando de trás para frente.
  const combo = (() => {
    let n = 0;
    for (let i = indice - (respondida ? 0 : 1); i >= 0; i--) {
      if (respostas[i]?.resultado.correta) n += 1;
      else break;
    }
    return n;
  })();

  async function conferir() {
    if (escolha === null || respondida) return;
    setErro(null);
    setConferindo(true);
    try {
      const resultado = await api.conferirQuestao({
        activity_id: activity.activity_id,
        question_index: indice,
        answer: escolha,
      });
      setRespostas((prev) => ({ ...prev, [indice]: { escolha, resultado } }));
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível conferir a resposta.");
    } finally {
      setConferindo(false);
    }
  }

  function continuar() {
    if (ultima) {
      const finais: Record<string, number> = {};
      Object.entries(respostas).forEach(([i, r]) => {
        finais[i] = r.escolha;
      });
      onConcluir(finais);
      return;
    }
    setIndice((i) => i + 1);
    setEscolha(null);
    setErro(null);
  }

  const acertou = respondida?.resultado.correta ?? false;

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-[560px] flex-col">
      {/* Barra de topo: uma saída e o progresso. Nada mais compete com a questão. */}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onSair}
          aria-label="Sair da lição"
          className="flex h-toque w-toque flex-none items-center justify-center rounded-capsula vidro-hud text-tinta-fraca shadow-hairline transition-colors duration-140 ease-out hover:text-tinta focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte"
        >
          <X className="h-[19px] w-[19px]" />
        </button>
        <ProgressBar
          className="flex-1"
          value={((indice + (respondida ? 1 : 0)) / total) * 100}
          aria-label={`Questão ${indice + 1} de ${total}`}
        />
      </div>

      <div className="mt-5">
        <div className="flex flex-wrap items-center gap-2">
          {respondida && !acertou ? (
            <span className="inline-flex h-7 items-center gap-1.5 rounded-capsula bg-erro/10 px-[11px] text-nota font-semibold text-erro">
              <Flame className="h-3.5 w-3.5" />
              Combo voltou a zero
            </span>
          ) : combo > 0 ? (
            <span className="inline-flex h-7 items-center gap-1.5 rounded-capsula bg-indigo/10 px-[11px] text-nota font-semibold text-indigo">
              <Flame className="h-3.5 w-3.5" />
              Combo <MetricText>×{combo}</MetricText>
            </span>
          ) : null}

          <span className="flex items-center gap-[7px] text-nota text-tinta-fraca">
            {questao.topico && <span className="truncate">{questao.topico} ·</span>}
            <MetricText tone="fraca">
              {indice + 1}/{total}
            </MetricText>
          </span>
        </div>

        <h2 className="mt-3.5 text-pretty text-enunciado text-tinta">{questao.enunciado}</h2>
      </div>

      <div className="mt-5">
        <InsetList>
          {questao.alternativas.map((alt, i) => {
            let estado: "default" | "selected" | "correct" | "incorrect" = "default";
            if (respondida) {
              if (i === respondida.resultado.resposta_correta) estado = "correct";
              else if (i === respondida.escolha) estado = "incorrect";
            } else if (escolha === i) {
              estado = "selected";
            }
            return (
              <QuizOption
                key={i}
                index={i}
                label={alt}
                state={estado}
                disabled={Boolean(respondida) || conferindo}
                ultima={i === questao.alternativas.length - 1}
                onClick={() => setEscolha(i)}
              />
            );
          })}
        </InsetList>
      </div>

      {erro && (
        <div className="mt-4">
          <InlineAlert>{erro}</InlineAlert>
        </div>
      )}
      {erroEnvio && (
        <div className="mt-4">
          <InlineAlert>{erroEnvio}</InlineAlert>
        </div>
      )}

      <div className="flex-1" />

      {/* Painel de resposta. Só aparece depois de conferir. */}
      {respondida ? (
        <div
          className={cn(
            "mt-6 rounded-[30px] p-[18px] backdrop-blur-[24px]",
            acertou ? "bg-acerto/14" : "bg-erro/12"
          )}
        >
          {/* Sempre alinhado ao topo. O desenho centra o Kango porque ali a
              explicação tem uma linha; as que o modelo escreve têm um
              parágrafo, e centrado o mascote fica boiando no meio do texto. */}
          <div className="flex items-start gap-3">
            <KangoPlaceholder px={52} tom={acertou ? "indigo" : "neutro"} />
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-[19px] font-bold tracking-[-0.02em]",
                  acertou ? "text-acerto" : "text-erro"
                )}
              >
                {acertou
                  ? "Certíssimo"
                  : `Quase. A resposta é ${
                      questao.alternativas[respondida.resultado.resposta_correta]
                    }.`}
              </p>
              {respondida.resultado.explicacao && (
                <p className="mt-1 text-pretty text-[14px] leading-[1.45] text-tinta">
                  {respondida.resultado.explicacao}
                </p>
              )}
            </div>
          </div>

          {/* A regra do produto dita: errar não custa nada. */}
          {!acertou && (
            <div className="mt-3.5 flex items-center gap-2 rounded-chip bg-white/60 px-3 py-2.5">
              <Info className="h-[15px] w-[15px] flex-none text-indigo" />
              <p className="text-nota leading-[1.4] text-tinta-fraca">
                Errar não tira nada de você, só ensina o Kango o que cobrar de novo.
              </p>
            </div>
          )}

          <div className="mt-3.5">
            <Capsule
              block
              loading={enviando}
              onClick={continuar}
              className={acertou ? "bg-acerto shadow-none hover:bg-[hsl(152_60%_21%)]" : undefined}
            >
              {enviando ? "Fechando a lição..." : ultima ? "Ver o resultado" : "Continuar"}
            </Capsule>
          </div>
        </div>
      ) : (
        <div className="mt-6">
          <Capsule block disabled={escolha === null} loading={conferindo} onClick={conferir}>
            {conferindo ? "Conferindo..." : "Responder"}
          </Capsule>
        </div>
      )}
    </div>
  );
}
