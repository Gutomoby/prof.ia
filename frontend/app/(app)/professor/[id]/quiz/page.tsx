"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronRight, Clock, Layers, Search, Sparkles } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Capsule } from "@/components/ui/capsule";
import { GlassCard } from "@/components/ui/glass-card";
import { InlineAlert } from "@/components/ui/inline-alert";
import { InsetList, InsetRow } from "@/components/ui/inset-list";
import { MetricText } from "@/components/ui/metric-text";
import { Pill, tonePilulaDaNota } from "@/components/ui/pill";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { useStartQuiz } from "@/lib/use-start-quiz";
import { cn, pctInteiro } from "@/lib/utils";
import {
  DIFFICULTY_LABELS,
  type ActivityHistoryItem,
  type Difficulty,
  type Module,
  type ScoreSummary,
} from "@/lib/types";

/*
  Tela 22 · Fazer um quiz. Só o formulário.

  A espera (23), a lição (37/38) e o resultado (39) vivem em /licao/[id], fora
  da casca do app — é o modo foco do handoff §08: "só a tela e uma saída, nada
  compete com a questão". Enquanto estavam aqui dentro, a lição aparecia com
  cabeçalho da matéria, régua de abas e barra de abas por cima dela.

  Duas coisas que este app tem e a tela 22 não mostra, mantidas porque removê-las
  quebraria função no ar:
  - Dificuldade, que já existe no backend e o plano previa virar Segmented.
  - Módulos: a trilha da tela 21 aponta para cá para o quiz do capítulo.
*/

// Deriva de DIFFICULTY_LABELS para o seletor e o histórico não divergirem —
// a ordem é a do produto (mais fácil primeiro), não a do objeto.
const DIFICULDADES: { value: Difficulty; label: string }[] = (
  ["facil", "medio", "dificil"] as const
).map((value) => ({ value, label: DIFFICULTY_LABELS[value] }));

export default function QuizPage({ params }: { params: { id: string } }) {
  const professorId = params.id;
  const { start } = useStartQuiz(professorId);

  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("medio");

  const [history, setHistory] = useState<ActivityHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [modules, setModules] = useState<Module[]>([]);
  const [summary, setSummary] = useState<ScoreSummary | null>(null);

  async function refreshHistory() {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await api.listAtividades(professorId, "quiz");
      setHistory(res.items);
    } catch (err) {
      setHistoryError(err instanceof ApiError ? err.message : "Não foi possível carregar o histórico.");
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    refreshHistory();
    api.listModules(professorId).then((r) => setModules(r.items)).catch(() => setModules([]));
    api.getScoreSummary(professorId).then(setSummary).catch(() => setSummary(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professorId]);

  const answeredHistory = history.filter((h) => h.score_pct != null);

  // Sugestões de tópico: os mais fracos primeiro, que é o que o desenho
  // destaca. O primeiro chip vem com a acurácia porque é o convite.
  const sugestoes = (summary?.topics ?? [])
    .filter((t) => t.status === "pendente")
    .sort((a, b) => a.accuracy_pct - b.accuracy_pct)
    .slice(0, 4);

  return (
    <div className="mx-auto flex max-w-[560px] flex-col gap-[22px]">
      <InsetList label="Tipo de atividade">
        <InsetRow
          active
          altura="dupla"
          icon={<Check />}
          iconTone="indigo"
          title="Quiz"
          subtitle={
            <>
              <MetricText tone="fraca">5 a 8</MetricText> questões · você vê o acerto na hora
            </>
          }
          trailing={<Check className="h-5 w-5 text-indigo" />}
        />
        <InsetRow
          disabled
          altura="dupla"
          icon={<Clock />}
          title={<span className="text-tinta-fraca">Reforço, Simulado e Prova</span>}
          subtitle="Em breve, por enquanto tudo é quiz"
        />
      </InsetList>

      <div>
        <p className="mb-2 px-rotulo-secao text-rotulo uppercase text-tinta-fraca">Dificuldade</p>
        <Segmented
          aria-label="Dificuldade das questões"
          value={difficulty}
          onValueChange={(v) => setDifficulty(v as Difficulty)}
          options={DIFICULDADES}
        />
      </div>

      <div>
        <p className="mb-2 px-rotulo-secao text-rotulo uppercase text-tinta-fraca">
          Sobre qual tópico?
        </p>
        <GlassCard nivel="cartao" radius="grupo" className="p-4">
          <div className="flex h-10 items-center gap-2.5 rounded-chip bg-cinza-tonal px-3">
            <Search className="h-4 w-4 flex-none text-tinta-fraca" aria-hidden />
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Ex.: Tábuas de Mortalidade"
              aria-label="Tópico do quiz"
              className="min-w-0 flex-1 bg-transparent text-[16px] text-tinta focus:outline-none placeholder:text-borda-forte"
            />
          </div>

          {sugestoes.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-2">
              {sugestoes.map((t, i) => {
                const escolhido = topic === t.topico;
                return (
                  <button
                    key={t.topico}
                    type="button"
                    onClick={() => setTopic(escolhido ? "" : t.topico)}
                    aria-pressed={escolhido}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-capsula px-[11px] py-1.5 text-nota",
                      "transition-colors duration-140 ease-out",
                      "focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte",
                      escolhido || i === 0
                        ? "bg-indigo/10 font-semibold text-indigo"
                        : "bg-cinza-tonal font-medium text-tinta-fraca hover:bg-borda"
                    )}
                  >
                    <span className="max-w-[13rem] truncate">{t.topico}</span>
                    {i === 0 && <MetricText weight="bold">{pctInteiro(t.accuracy_pct)}%</MetricText>}
                  </button>
                );
              })}
            </div>
          )}
        </GlassCard>
        <p className="mt-2 px-rotulo-secao text-nota leading-[1.4] text-tinta-fraca">
          Deixe em branco e o Kango escolhe o tópico em que você está mais fraco.
        </p>
      </div>

      <Capsule block onClick={() => start(topic || null, { difficulty })}>
        <Sparkles className="h-[17px] w-[17px]" />
        Gerar quiz
      </Capsule>

      {modules.length > 0 && (
        <InsetList
          label="Ou o capítulo inteiro"
          footnote="Quiz do módulo cobre todos os tópicos do capítulo, com 8 a 10 questões."
        >
          {modules
            .slice()
            .sort((a, b) => a.position - b.position)
            .map((m) => (
              <InsetRow
                key={m.id}
                altura="dupla"
                icon={<Layers />}
                title={m.name}
                subtitle={
                  m.n_tentativas === 0 ? (
                    "Nunca tentado"
                  ) : (
                    <>
                      <MetricText tone="fraca">{m.n_tentativas}</MetricText>{" "}
                      {m.n_tentativas === 1 ? "tentativa" : "tentativas"}
                    </>
                  )
                }
                value={
                  m.melhor_score_pct === null ? undefined : (
                    <Pill tone={tonePilulaDaNota(pctInteiro(m.melhor_score_pct))}>
                      <MetricText>{pctInteiro(m.melhor_score_pct)}%</MetricText>
                    </Pill>
                  )
                }
                onClick={() => start(null, { moduleId: m.id, difficulty, rotulo: m.name })}
                trailing={<ChevronRight className="h-[18px] w-[18px]" />}
              />
            ))}
        </InsetList>
      )}

      <div>
        <div className="mb-2 flex items-baseline justify-between gap-3 px-rotulo-secao">
          <p className="text-rotulo uppercase text-tinta-fraca">Suas tentativas</p>
          {history.length > 0 && (
            <Link
              href={`/professor/${professorId}/quiz/historico`}
              className="text-nota font-semibold text-indigo hover:underline focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte"
            >
              Ver todas (<MetricText tone="indigo">{history.length}</MetricText>)
            </Link>
          )}
        </div>

        {historyLoading ? (
          <Skeleton className="h-[104px] rounded-grupo" />
        ) : historyError ? (
          <InlineAlert>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>{historyError}</span>
              <Capsule variant="secundaria" onClick={refreshHistory}>
                Tentar novamente
              </Capsule>
            </div>
          </InlineAlert>
        ) : answeredHistory.length === 0 ? (
          <p className="px-rotulo-secao text-nota text-tinta-fraca">
            Nenhuma tentativa ainda. Gere o primeiro quiz aqui em cima.
          </p>
        ) : (
          <InsetList>
            {answeredHistory.slice(0, 8).map((h) => (
              <InsetRow
                key={h.id}
                href={`/professor/${professorId}/quiz/historico/${h.id}`}
                altura="dupla"
                title={h.topic || "Tópico geral"}
                subtitle={
                  <>
                    <MetricText tone="fraca">
                      {new Date(h.created_at).toLocaleDateString("pt-BR")}
                    </MetricText>
                    {h.difficulty ? ` · ${DIFFICULTY_LABELS[h.difficulty]}` : ""}
                  </>
                }
                value={
                  <Pill tone={tonePilulaDaNota(pctInteiro(h.score_pct as number))}>
                    <MetricText>{pctInteiro(h.score_pct as number)}%</MetricText>
                  </Pill>
                }
                trailing={<ChevronRight className="h-[18px] w-[18px]" />}
              />
            ))}
          </InsetList>
        )}
      </div>
    </div>
  );
}
