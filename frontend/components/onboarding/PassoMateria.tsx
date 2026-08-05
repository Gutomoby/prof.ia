"use client";

import { useState } from "react";
import { CalendarDays, Check, GraduationCap, Plus, UserRoundPen } from "lucide-react";
import { Capsule } from "@/components/ui/capsule";
import { InlineAlert } from "@/components/ui/inline-alert";
import { InsetList, InsetRow } from "@/components/ui/inset-list";
import { MetricText } from "@/components/ui/metric-text";
import { PassoHeader } from "@/components/onboarding/PassoHeader";
import { cn } from "@/lib/utils";

/*
  Tela 06 · Escolher a matéria (1 de 3).

  As sugestões são só um atalho de digitação: a matéria é texto livre no
  backend, e "Outra" abre o campo. Nenhuma delas é categoria — não há lista
  fechada de matérias em lugar nenhum do produto.

  "Prova ou concurso" é um interruptor de verdade, não um selo: ligado, a
  data entra em exam_dates (que vai no system_prompt do professor, em
  routers/professores.py) e vira um evento de prova no calendário; desligado,
  o professor nasce sem data e o plano não prioriza nada por prazo. Um check
  que não desmarca seria decoração.
*/

const SUGESTOES = [
  "Ciências Atuariais",
  "Cálculo",
  "Redação ENEM",
  "Direito",
  "Farmacologia",
  "Concurso público",
];

export interface DadosMateria {
  discipline: string;
  nomeProfessor: string;
  /** ISO YYYY-MM-DD, ou null quando não há prova marcada. */
  dataProva: string | null;
}

function Chip({
  ativo,
  onClick,
  children,
}: {
  ativo?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={cn(
        "inline-flex items-center gap-[7px] rounded-capsula px-[15px] py-[11px] text-corpo",
        "transition-all duration-140 ease-out",
        "focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte",
        ativo
          ? "bg-indigo font-semibold text-papel"
          : "vidro-cartao font-medium text-tinta shadow-hairline hover:shadow-[inset_0_0_0_1.5px_hsl(var(--indigo))] hover:bg-indigo/6"
      )}
    >
      {ativo && <Check className="h-[15px] w-[15px]" strokeWidth={3} />}
      {children}
    </button>
  );
}

export function PassoMateria({
  inicial,
  onVoltar,
  onContinuar,
  enviando,
  erro,
}: {
  /** Valores de quem já passou por aqui e voltou do passo 2. */
  inicial?: DadosMateria | null;
  onVoltar: () => void;
  onContinuar: (dados: DadosMateria) => void;
  enviando: boolean;
  erro: string | null;
}) {
  const escolhida = inicial?.discipline ?? "";
  const eraSugestao = SUGESTOES.includes(escolhida);

  const [sugestao, setSugestao] = useState<string | null>(eraSugestao ? escolhida : null);
  const [modoOutra, setModoOutra] = useState(Boolean(escolhida) && !eraSugestao);
  const [outra, setOutra] = useState(eraSugestao ? "" : escolhida);
  const [comProva, setComProva] = useState(inicial ? Boolean(inicial.dataProva) : true);
  const [dataProva, setDataProva] = useState(inicial?.dataProva ?? "");
  const [nome, setNome] = useState(inicial?.nomeProfessor ?? "");

  const materia = (modoOutra ? outra : sugestao ?? "").trim();
  const sugestaoNome = materia ? `Prof. ${materia}` : "Prof. Atuária";
  const podeContinuar = materia.length > 0;

  function continuar() {
    if (!podeContinuar) return;
    onContinuar({
      discipline: materia,
      nomeProfessor: nome.trim() || sugestaoNome,
      dataProva: comProva && dataProva ? dataProva : null,
    });
  }

  return (
    <div className="flex flex-1 flex-col">
      <PassoHeader passo={1} onVoltar={onVoltar} />

      <div className="flex-none pt-5">
        <h1 className="text-pretty text-titulo-estado">Por qual matéria a gente começa?</h1>
        <p className="mt-2 text-pretty text-corpo text-tinta-fraca">
          Escolha a que mais te preocupa agora. Depois você adiciona outras.
        </p>
      </div>

      <div className="mt-5 flex flex-none flex-wrap gap-[9px]">
        {SUGESTOES.map((s) => (
          <Chip
            key={s}
            ativo={sugestao === s}
            onClick={() => {
              setSugestao(sugestao === s ? null : s);
              setModoOutra(false);
            }}
          >
            {s}
          </Chip>
        ))}
        <Chip
          ativo={modoOutra}
          onClick={() => {
            setModoOutra(true);
            setSugestao(null);
          }}
        >
          {!modoOutra && <Plus className="h-[15px] w-[15px]" />}
          Outra
        </Chip>
      </div>

      {modoOutra && (
        <input
          autoFocus
          value={outra}
          onChange={(e) => setOutra(e.target.value)}
          placeholder="Escreva a matéria"
          aria-label="Outra matéria"
          className={cn(
            "mt-3 h-capsula-tonal flex-none rounded-chip bg-white px-4 text-linha text-tinta shadow-hairline",
            "placeholder:text-borda-forte focus:outline-none focus-visible:shadow-foco-forte"
          )}
        />
      )}

      <p className="mb-2 mt-6 flex-none px-rotulo-secao text-rotulo uppercase text-tinta-fraca">
        Como quer ser cobrado
      </p>
      <div className="flex-none">
        <InsetList>
          <InsetRow
            altura="campo"
            active={comProva}
            icon={<GraduationCap />}
            iconTone={comProva ? "indigo" : "inativo"}
            title="Prova ou concurso"
            subtitle="Ele prioriza o que cai antes"
            onClick={() => setComProva(!comProva)}
            trailing={
              comProva ? (
                <Check className="h-[18px] w-[18px] text-indigo" strokeWidth={3} />
              ) : (
                <span className="h-[18px] w-[18px] rounded-capsula shadow-hairline" />
              )
            }
          />

          {comProva && (
            <label className="relative flex min-h-linha-campo items-center gap-3 px-4">
              <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-icone bg-erro/12">
                <CalendarDays className="h-[17px] w-[17px] text-erro" />
              </span>
              <span className="flex-1 text-linha">Data da prova</span>
              <input
                type="date"
                value={dataProva}
                onChange={(e) => setDataProva(e.target.value)}
                aria-label="Data da prova"
                className={cn(
                  "flex-none rounded-capsula bg-cinza-tonal px-[11px] py-[5px]",
                  "font-mono text-corpo font-semibold tabular-nums tracking-[-0.02em] text-tinta",
                  "focus:outline-none focus-visible:shadow-foco-forte"
                )}
              />
              <span
                aria-hidden
                data-sep
                className="pointer-events-none absolute bottom-0 left-[58px] right-0 h-[0.5px] bg-borda"
              />
            </label>
          )}

          <label className="relative flex min-h-linha-dupla items-center gap-3 px-4">
            <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-icone bg-cinza-tonal text-tinta-fraca">
              <UserRoundPen className="h-[17px] w-[17px]" />
            </span>
            {/* O desenho põe a sugestão no subtítulo ("Sugeri Prof. Atuária")
                porque lá a linha abre outra tela. Aqui o campo é a própria
                linha, e a sugestão já está no placeholder — repetir os dois
                quebraria o subtítulo em duas linhas para dizer a mesma coisa. */}
            <span className="min-w-0 flex-1">
              <span className="block text-linha">Nome do professor</span>
              <span className="mt-0.5 block truncate text-nota text-tinta-fraca">
                Dá pra trocar depois
              </span>
            </span>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder={sugestaoNome}
              aria-label="Nome do professor"
              className={cn(
                "w-[42%] min-w-0 flex-none bg-transparent text-right text-linha text-tinta",
                "placeholder:text-borda-forte focus:outline-none"
              )}
            />
            <span
              aria-hidden
              data-sep
              className="pointer-events-none absolute bottom-0 left-[58px] right-0 h-[0.5px] bg-borda"
            />
          </label>
        </InsetList>
      </div>

      {erro && (
        <div className="mt-4 flex-none">
          <InlineAlert>{erro}</InlineAlert>
        </div>
      )}

      <div className="min-h-3.5 flex-1" />

      <Capsule block onClick={continuar} loading={enviando} disabled={!podeContinuar}>
        {enviando ? "Criando..." : "Continuar"}
      </Capsule>
      {!podeContinuar && (
        <p className="mt-2 flex-none text-center text-nota text-tinta-fraca">
          Escolha uma matéria para seguir. Leva <MetricText tone="fraca">2</MetricText> minutos até o
          diagnóstico.
        </p>
      )}
    </div>
  );
}
