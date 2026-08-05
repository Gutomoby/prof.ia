"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Capsule } from "@/components/ui/capsule";
import { GlassCard } from "@/components/ui/glass-card";
import { InlineAlert } from "@/components/ui/inline-alert";
import { InsetList, InsetRow } from "@/components/ui/inset-list";
import { MetricText } from "@/components/ui/metric-text";
import { Pill, tonePilulaDaNota } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, pctInteiro } from "@/lib/utils";
import { DIFFICULTY_LABELS, type ActivityHistoryItem, type Professor } from "@/lib/types";

/*
  Tela 24 · Tentativas.

  Destino próprio, alcançado do "Ver todas" da tela 22 — a tela do quiz mostra
  só as últimas.

  As tentativas SEM nota entram na lista, com a pílula "não terminou". É o
  desenho e é o certo: um quiz gerado e abandonado é informação, e escondê-lo
  faz a conta de "14 quizzes" não bater com o que se vê.
*/

const PAGINA = 12;

/*
  "1 min 40 s". O handoff põe a linha inteira em mono, mas o guia §03 é
  explícito: "Palavra nunca entra em mono". Só o número vai — por isso a função
  devolve as partes em vez de uma string pronta.
*/
function duracao(segundos: number | null): { min: number | null; seg: string } | null {
  if (segundos === null || segundos <= 0) return null;
  const min = Math.floor(segundos / 60);
  const seg = segundos % 60;
  if (min === 0) return { min: null, seg: String(seg) };
  return { min, seg: String(seg).padStart(2, "0") };
}

/** Segunda-feira da semana da data, no fuso local. */
function inicioDaSemana(d: Date): Date {
  const copia = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  // getDay(): 0 = domingo. A semana do produto começa na segunda.
  const desloc = (copia.getDay() + 6) % 7;
  copia.setDate(copia.getDate() - desloc);
  return copia;
}

function rotuloDoGrupo(iso: string): string {
  const agora = new Date();
  const semanaAtual = inicioDaSemana(agora);
  const semanaPassada = new Date(semanaAtual);
  semanaPassada.setDate(semanaPassada.getDate() - 7);

  const data = new Date(iso);
  const dia = new Date(data.getFullYear(), data.getMonth(), data.getDate());

  if (dia >= semanaAtual) return "Esta semana";
  if (dia >= semanaPassada) return "Semana passada";
  return data.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function Estatistica({ valor, rotulo }: { valor: React.ReactNode; rotulo: string }) {
  return (
    <div className="flex-1 px-2 py-3 text-center">
      <MetricText weight="bold" as="p" className="text-[19px] leading-none">
        {valor}
      </MetricText>
      <p className="mt-[3px] text-[11.5px] text-tinta-fraca">{rotulo}</p>
    </div>
  );
}

export default function TentativasPage({ params }: { params: { id: string } }) {
  const professorId = params.id;

  const [items, setItems] = useState<ActivityHistoryItem[]>([]);
  const [professor, setProfessor] = useState<Professor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<string | null>(null);
  const [visiveis, setVisiveis] = useState(PAGINA);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listAtividades(professorId, "quiz");
      setItems(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível carregar as tentativas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    api.getProfessor(professorId).then(setProfessor).catch(() => setProfessor(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professorId]);

  // Tópicos com pelo menos duas tentativas viram filtro: com uma só, o chip
  // seria um atalho para uma linha que já está logo abaixo.
  const topicos = useMemo(() => {
    const conta = new Map<string, number>();
    items.forEach((a) => {
      if (a.topic) conta.set(a.topic, (conta.get(a.topic) ?? 0) + 1);
    });
    return [...conta.entries()]
      .filter(([, n]) => n > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
  }, [items]);

  const filtrados = useMemo(
    () => (filtro ? items.filter((a) => a.topic === filtro) : items),
    [items, filtro]
  );

  const comNota = filtrados.filter((a) => a.score_pct !== null);
  const media =
    comNota.length > 0
      ? comNota.reduce((soma, a) => soma + (a.score_pct as number), 0) / comNota.length
      : null;
  const melhor = comNota.length > 0 ? Math.max(...comNota.map((a) => a.score_pct as number)) : null;
  const semTerminar = filtrados.length - comNota.length;

  // Agrupa preservando a ordem que a API devolve (mais recentes primeiro).
  const grupos = useMemo(() => {
    const mapa = new Map<string, ActivityHistoryItem[]>();
    filtrados.slice(0, visiveis).forEach((a) => {
      const chave = rotuloDoGrupo(a.created_at);
      const lista = mapa.get(chave);
      if (lista) lista.push(a);
      else mapa.set(chave, [a]);
    });
    return [...mapa.entries()];
  }, [filtrados, visiveis]);

  const restantes = filtrados.length - visiveis;

  if (loading) {
    return (
      <div className="mx-auto flex max-w-[560px] flex-col gap-4">
        <Skeleton className="h-[68px] rounded-cartao" />
        <Skeleton className="h-[180px] rounded-grupo" />
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

  return (
    <div className="mx-auto flex max-w-[560px] flex-col">
      <p className="text-[14px] text-tinta-fraca">
        <MetricText weight="bold">{items.length}</MetricText>{" "}
        {items.length === 1 ? "quiz" : "quizzes"}
        {professor ? ` em ${professor.discipline}` : ""}
      </p>

      {topicos.length > 0 && (
        <div className="mt-3.5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFiltro(null)}
            aria-pressed={filtro === null}
            className={cn(
              "rounded-capsula px-[13px] py-2 text-[14px] font-semibold transition-colors duration-140 ease-out",
              "focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte",
              filtro === null
                ? "bg-indigo text-papel"
                : "vidro-cartao text-tinta shadow-hairline hover:bg-white"
            )}
          >
            Todos
          </button>
          {topicos.map(([nome, n]) => {
            const ativo = filtro === nome;
            return (
              <button
                key={nome}
                type="button"
                onClick={() => setFiltro(ativo ? null : nome)}
                aria-pressed={ativo}
                className={cn(
                  "flex items-center gap-1.5 rounded-capsula px-[13px] py-2 text-[14px] transition-colors duration-140 ease-out",
                  "focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte",
                  ativo
                    ? "bg-indigo font-semibold text-papel"
                    : "vidro-cartao font-medium text-tinta shadow-hairline hover:bg-white"
                )}
              >
                <span className="max-w-[10rem] truncate">{nome}</span>
                <MetricText>{n}</MetricText>
              </button>
            );
          })}
        </div>
      )}

      <GlassCard nivel="cartao" radius="cartao" className="mt-3.5 flex items-stretch">
        <Estatistica
          valor={media === null ? "—" : `${pctInteiro(media)}%`}
          rotulo="média geral"
        />
        <span aria-hidden className="w-[0.5px] flex-none bg-borda" />
        <Estatistica
          valor={melhor === null ? "—" : `${pctInteiro(melhor)}%`}
          rotulo="melhor nota"
        />
        <span aria-hidden className="w-[0.5px] flex-none bg-borda" />
        <Estatistica valor={semTerminar} rotulo="sem terminar" />
      </GlassCard>

      {filtrados.length === 0 ? (
        <p className="mt-6 px-rotulo-secao text-nota text-tinta-fraca">
          {filtro
            ? `Nenhuma tentativa em "${filtro}".`
            : "Nenhuma tentativa ainda. Gere o primeiro quiz na aba Quiz."}
        </p>
      ) : (
        grupos.map(([rotulo, lista]) => (
          <div key={rotulo} className="mt-[22px]">
            <p className="mb-2 px-rotulo-secao text-rotulo uppercase text-tinta-fraca">{rotulo}</p>
            <InsetList>
              {lista.map((a) => {
                const tempo = duracao(a.time_seconds);
                const terminou = a.score_pct !== null;
                return (
                  <InsetRow
                    key={a.id}
                    href={terminou ? `/professor/${professorId}/quiz/historico/${a.id}` : undefined}
                    altura="dupla"
                    title={a.topic || "Tópico geral"}
                    subtitle={
                      <>
                        <MetricText tone="fraca">
                          {new Date(a.created_at).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                          })}
                        </MetricText>
                        {tempo ? (
                          <>
                            {" · "}
                            {tempo.min !== null && (
                              <>
                                <MetricText tone="fraca">{tempo.min}</MetricText> min{" "}
                              </>
                            )}
                            <MetricText tone="fraca">{tempo.seg}</MetricText> s
                          </>
                        ) : null}
                        {a.difficulty ? ` · ${DIFFICULTY_LABELS[a.difficulty]}` : ""}
                      </>
                    }
                    value={
                      terminou ? (
                        <Pill tone={tonePilulaDaNota(pctInteiro(a.score_pct as number))}>
                          <MetricText>{pctInteiro(a.score_pct as number)}%</MetricText>
                        </Pill>
                      ) : (
                        // Sem número: "não terminou" é estado, não nota, e em
                        // mono leria como métrica.
                        <Pill>não terminou</Pill>
                      )
                    }
                    trailing={
                      terminou ? <ChevronRight className="h-[18px] w-[18px]" /> : undefined
                    }
                  />
                );
              })}
            </InsetList>
          </div>
        ))
      )}

      {restantes > 0 && (
        <button
          type="button"
          onClick={() => setVisiveis((v) => v + PAGINA)}
          className="mt-6 rounded-chip py-2 text-center text-corpo font-medium text-indigo hover:underline focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte"
        >
          Carregar as <MetricText tone="indigo">{restantes}</MetricText> mais antigas
        </button>
      )}
    </div>
  );
}
