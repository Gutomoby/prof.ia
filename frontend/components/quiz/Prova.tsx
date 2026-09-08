"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, ListChecks, X } from "lucide-react";
import { Capsule } from "@/components/ui/capsule";
import { InlineAlert } from "@/components/ui/inline-alert";
import { InsetList } from "@/components/ui/inset-list";
import { MetricText } from "@/components/ui/metric-text";
import { ProgressBar } from "@/components/ui/gauge";
import { QuizOption } from "@/components/quiz/QuizOption";
import { MathText } from "@/components/ui/math-text";
import { cn } from "@/lib/utils";
import type { GeneratedActivity } from "@/lib/types";

/*
  Modo Prova — a matéria inteira de uma vez, correção só no final (ao
  contrário da Lição, que corrige questão por questão via /atividades/conferir).

  Por isso a navegação aqui é livre: o aluno pode ir e voltar, mudar resposta,
  ver quais questões ainda estão em branco — como numa prova de papel, antes
  de entregar. Nenhuma alternativa mostra certo/errado até o envio final.
*/

export function Prova({
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
  const [respostas, setRespostas] = useState<Record<number, number>>({});
  const [revisando, setRevisando] = useState(false);

  const total = activity.questions.length;
  const questao = activity.questions[indice];
  const respondidas = Object.keys(respostas).length;
  const ultima = indice === total - 1;

  function irPara(i: number) {
    setIndice(i);
    setRevisando(false);
  }

  function enviar() {
    const finais: Record<string, number> = {};
    Object.entries(respostas).forEach(([i, escolha]) => {
      finais[i] = escolha;
    });
    onConcluir(finais);
  }

  if (revisando) {
    return (
      <div className="mx-auto flex min-h-[80vh] max-w-[560px] flex-col md:max-w-[640px]">
        <div className="flex flex-none items-center gap-2.5">
          <button
            type="button"
            onClick={() => setRevisando(false)}
            aria-label="Voltar para a prova"
            className="flex h-toque w-toque flex-none items-center justify-center rounded-capsula vidro-hud text-tinta-fraca shadow-hairline transition-colors duration-140 ease-out hover:text-tinta focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte"
          >
            <ChevronLeft className="h-[19px] w-[19px]" />
          </button>
          <p className="text-titulo-cartao font-bold text-tinta">Revisar antes de enviar</p>
        </div>

        <p className="mt-3 text-corpo text-tinta-fraca">
          <MetricText tone={respondidas === total ? "indigo" : "erro"} weight="bold">
            {respondidas}
          </MetricText>{" "}
          de <MetricText tone="fraca">{total}</MetricText> questões respondidas. Toque numa para voltar a ela.
        </p>

        <div className="mt-4 flex-1 overflow-y-auto pb-[130px]">
          <InsetList>
            {activity.questions.map((q, i) => (
              <button
                key={i}
                type="button"
                onClick={() => irPara(i)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-140 ease-out hover:bg-indigo/5"
              >
                <span
                  className={cn(
                    "flex h-7 w-7 flex-none items-center justify-center rounded-capsula text-[13px] font-bold",
                    i in respostas ? "bg-indigo/12 text-indigo" : "bg-cinza-tonal text-tinta-fraca"
                  )}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-corpo text-tinta">{q.enunciado}</span>
                {!(i in respostas) && (
                  <span className="flex-none text-nota font-semibold text-erro">Em branco</span>
                )}
              </button>
            ))}
          </InsetList>
        </div>

        {erroEnvio && (
          <div className="mb-3">
            <InlineAlert>{erroEnvio}</InlineAlert>
          </div>
        )}

        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center px-3 pb-3.5">
          <div className="pointer-events-auto w-full max-w-[536px] rounded-[30px] bg-papel p-3.5 backdrop-blur-[24px] shadow-vidro-flutuante">
            <Capsule block loading={enviando} onClick={enviar}>
              {enviando ? "Enviando..." : respondidas < total ? "Enviar mesmo assim" : "Enviar prova"}
            </Capsule>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-[560px] flex-col md:min-h-[calc(100dvh-68px)] md:max-w-[860px] md:justify-center">
      <div className="flex flex-none items-center gap-2.5 md:gap-4">
        <button
          type="button"
          onClick={onSair}
          aria-label="Sair da prova"
          className="flex h-toque w-toque flex-none items-center justify-center rounded-capsula vidro-hud text-tinta-fraca shadow-hairline transition-colors duration-140 ease-out hover:text-tinta focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte"
        >
          <X className="h-[19px] w-[19px]" />
        </button>

        <ProgressBar
          className="flex-1 md:max-w-[520px]"
          value={((indice + 1) / total) * 100}
          aria-label={`Questão ${indice + 1} de ${total}`}
        />

        <button
          type="button"
          onClick={() => setRevisando(true)}
          className="flex h-toque flex-none items-center gap-1.5 rounded-capsula px-3 text-nota font-semibold text-indigo hover:bg-indigo/6 focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte"
        >
          <ListChecks className="h-4 w-4" />
          <span>
            {respondidas}/{total}
          </span>
        </button>
      </div>

      <div className="mt-5 md:mt-6">
        <p className="text-nota text-tinta-fraca">
          Questão {indice + 1} de {total}
          {questao.topico && <> · {questao.topico}</>}
        </p>
        <MathText as="p" className="mt-1.5 text-pretty text-enunciado text-tinta md:text-enunciado-lg">
          {questao.enunciado}
        </MathText>
      </div>

      <div className="mt-5">
        <InsetList>
          {questao.alternativas.map((alt, i) => (
            <QuizOption
              key={i}
              index={i}
              label={alt}
              state={respostas[indice] === i ? "selected" : "default"}
              ultima={i === questao.alternativas.length - 1}
              onClick={() => setRespostas((prev) => ({ ...prev, [indice]: i }))}
            />
          ))}
        </InsetList>
      </div>

      {/* Espaço para a barra fixa de navegação não cobrir a última alternativa. */}
      <div className="min-h-[110px] flex-1" />

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center px-3 pb-3.5">
        <div className="pointer-events-auto flex w-full max-w-[536px] items-center gap-2.5 rounded-[30px] bg-papel p-3.5 backdrop-blur-[24px] shadow-vidro-flutuante">
          <Capsule
            variant="secundaria"
            aria-label="Questão anterior"
            disabled={indice === 0}
            onClick={() => setIndice((i) => Math.max(0, i - 1))}
          >
            <ChevronLeft className="h-[17px] w-[17px]" />
          </Capsule>
          <Capsule
            block
            onClick={() => (ultima ? setRevisando(true) : setIndice((i) => Math.min(total - 1, i + 1)))}
          >
            {ultima ? "Revisar e enviar" : "Próxima"}
            {!ultima && <ChevronRight className="h-[17px] w-[17px]" />}
          </Capsule>
        </div>
      </div>
    </div>
  );
}
