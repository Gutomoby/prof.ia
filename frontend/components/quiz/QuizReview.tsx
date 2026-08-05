import { Check, X } from "lucide-react";
import { Gauge } from "@/components/ui/gauge";
import { GlassCard } from "@/components/ui/glass-card";
import { InsetList } from "@/components/ui/inset-list";
import { MetricText } from "@/components/ui/metric-text";
import { cn, pctInteiro } from "@/lib/utils";
import { MathText } from "@/components/ui/math-text";
import type { SubmittedQuestionResult } from "@/lib/types";

/*
  Tela 40 · Revisão da tentativa.

  O handoff lista só as questões ERRADAS ("As 2 que você errou"). É a decisão
  certa: quem revisita uma tentativa vai atrás do que falhou, e reler cinco
  acertos para achar dois erros é trabalho à toa. As acertadas ficam num grupo
  recolhido no fim, para quem quiser conferir.

  Cada erro mostra as duas linhas que importam — o que você marcou e qual era —
  e a explicação embaixo. As outras duas alternativas não entram: não
  aconteceram.
*/

function LinhaResposta({
  texto,
  tipo,
  rotulo,
}: {
  texto: string;
  tipo: "erro" | "acerto";
  rotulo?: string;
}) {
  const acerto = tipo === "acerto";
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-bolha px-3 py-2.5",
        acerto ? "bg-acerto/10" : "bg-erro/10"
      )}
    >
      {acerto ? (
        <Check className="h-4 w-4 flex-none text-acerto" strokeWidth={3} />
      ) : (
        <X className="h-4 w-4 flex-none text-erro" strokeWidth={3} />
      )}
      <MathText className={cn("flex-1 text-corpo", acerto && "font-semibold")}>{texto}</MathText>
      {rotulo && (
        <span
          className={cn(
            "flex-none text-[12px] font-semibold",
            acerto ? "text-acerto" : "text-erro"
          )}
        >
          {rotulo}
        </span>
      )}
    </div>
  );
}

function QuestaoErrada({ q }: { q: SubmittedQuestionResult }) {
  return (
    <div className="relative px-4 pb-4 pt-3.5">
      <MathText as="p" className="text-pretty text-[16px] font-semibold leading-[1.35] tracking-[-0.43px] text-tinta">
        {q.enunciado}
      </MathText>

      <div className="mt-2.5 flex flex-col gap-1.5">
        {q.resposta_usuario !== null && (
          <LinhaResposta
            texto={q.alternativas[q.resposta_usuario]}
            tipo="erro"
            rotulo="você marcou"
          />
        )}
        <LinhaResposta
          texto={q.alternativas[q.resposta_correta]}
          tipo="acerto"
          rotulo={q.resposta_usuario === null ? "era essa" : "era essa"}
        />
      </div>

      {q.explicacao && (
        <MathText as="p" className="mt-2.5 text-pretty text-nota leading-[1.45] text-tinta-fraca">
          {q.explicacao}
        </MathText>
      )}

      <span
        aria-hidden
        data-sep
        className="pointer-events-none absolute bottom-0 left-4 right-0 h-[0.5px] bg-borda"
      />
    </div>
  );
}

export function QuizReview({
  scorePct,
  questions,
  tempoSegundos,
  xpGanho,
  footer,
}: {
  scorePct: number;
  questions: SubmittedQuestionResult[];
  tempoSegundos?: number | null;
  xpGanho?: number;
  footer?: React.ReactNode;
}) {
  const certas = questions.filter((q) => q.correta).length;
  const erradas = questions.filter((q) => !q.correta);

  const min = tempoSegundos ? Math.floor(tempoSegundos / 60) : null;
  const seg = tempoSegundos ? tempoSegundos % 60 : null;

  return (
    <div className="mx-auto flex max-w-[560px] flex-col gap-4">
      <GlassCard nivel="cartao" radius="grupo" className="flex items-center gap-4 p-4">
        <Gauge value={scorePct} size={72} tone="nota" />
        <div className="min-w-0 flex-1">
          <p className="text-linha font-bold text-tinta">
            <MetricText weight="bold">{certas}</MetricText> de{" "}
            <MetricText weight="bold">{questions.length}</MetricText> certas
          </p>
          {(tempoSegundos || xpGanho !== undefined) && (
            <p className="mt-0.5 text-nota text-tinta-fraca">
              {tempoSegundos ? (
                <>
                  Levou{" "}
                  {min !== null && min > 0 && (
                    <>
                      <MetricText tone="fraca">{min}</MetricText> min{" "}
                    </>
                  )}
                  <MetricText tone="fraca">{seg}</MetricText> s
                </>
              ) : null}
              {tempoSegundos && xpGanho !== undefined ? " · ganhou " : ""}
              {xpGanho !== undefined && (
                <>
                  <MetricText tone="fraca">+{xpGanho}</MetricText> XP
                </>
              )}
            </p>
          )}
        </div>
      </GlassCard>

      {erradas.length > 0 ? (
        <div>
          <p className="mb-2 px-rotulo-secao text-rotulo uppercase text-erro">
            {erradas.length === 1 ? "A que você errou" : `As ${erradas.length} que você errou`}
          </p>
          <InsetList>
            {erradas.map((q, i) => (
              <QuestaoErrada key={i} q={q} />
            ))}
          </InsetList>
        </div>
      ) : (
        <p className="px-rotulo-secao text-corpo text-acerto">
          Você acertou tudo nesta tentativa.
        </p>
      )}

      {certas > 0 && erradas.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer list-none px-rotulo-secao text-nota font-semibold text-indigo hover:underline">
            Ver as <MetricText tone="indigo">{certas}</MetricText> que você acertou
          </summary>
          <div className="mt-2">
            <InsetList>
              {questions
                .filter((q) => q.correta)
                .map((q, i) => (
                  <div key={i} className="relative px-4 pb-4 pt-3.5">
                    <MathText as="p" className="text-pretty text-[16px] font-semibold leading-[1.35] tracking-[-0.43px] text-tinta">
                      {q.enunciado}
                    </MathText>
                    <div className="mt-2.5">
                      <LinhaResposta
                        texto={q.alternativas[q.resposta_correta]}
                        tipo="acerto"
                        rotulo="você acertou"
                      />
                    </div>
                    <span
                      aria-hidden
                      data-sep
                      className="pointer-events-none absolute bottom-0 left-4 right-0 h-[0.5px] bg-borda"
                    />
                  </div>
                ))}
            </InsetList>
          </div>
        </details>
      )}

      {footer}
    </div>
  );
}
