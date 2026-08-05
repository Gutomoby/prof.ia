"use client";

import Link from "next/link";
import { Check, CircleDashed, Compass, Play } from "lucide-react";
import { capsuleVariants } from "@/components/ui/capsule";
import { InsetList } from "@/components/ui/inset-list";
import { KangoPlaceholder } from "@/components/ui/kango-placeholder";
import { MetricText } from "@/components/ui/metric-text";
import { cn } from "@/lib/utils";
import type { ActivityDetail, Professor, StudyPlan } from "@/lib/types";

/*
  Tela 11 · Diagnóstico pronto — a parte de desenhar.

  Separada da rota pelo mesmo motivo do ResultadoLicao: a leitura do
  diagnóstico é uma conta sobre as questões respondidas, e conta se confere
  melhor quando dá para renderizar com dado na mão.

  Duas frases do desenho mudaram porque o produto define as palavras delas:

  - "Você já domina" virou "Você acertou tudo". Dominado, neste app, é acertar
    70% do tópico DUAS vezes (é o que a dica da tela 23 promete e o que
    services/scoring.py aplica). Uma tentativa não domina nada, e usar a
    palavra aqui contradiria a trilha logo na primeira tela.
  - "Liberam conforme você domina os anteriores" virou "O diagnóstico não
    passou por eles". Não existe desbloqueio: TopicStat.status só tem
    dominado|pendente e nada bloqueia lição nenhuma (item 4 do consolidado de
    backend). Cadeado desenhado sobre porta aberta é promessa falsa.
*/

function LinhaTopico({
  badge,
  titulo,
  detalhe,
  destaque,
  detalheIndigo,
}: {
  badge: React.ReactNode;
  titulo: React.ReactNode;
  detalhe: React.ReactNode;
  destaque?: boolean;
  detalheIndigo?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative flex min-h-linha-dupla items-center gap-3 px-4",
        destaque && "bg-indigo/8"
      )}
    >
      {badge}
      <span className="min-w-0 flex-1">
        <span
          className={cn("block truncate text-[16px] tracking-[-0.43px]", destaque && "font-semibold")}
        >
          {titulo}
        </span>
        <span
          className={cn(
            "mt-0.5 block truncate text-nota",
            detalheIndigo ? "text-indigo" : "text-tinta-fraca"
          )}
        >
          {detalhe}
        </span>
      </span>
      <span
        aria-hidden
        data-sep
        className="pointer-events-none absolute bottom-0 left-[62px] right-0 h-[0.5px] bg-borda"
      />
    </div>
  );
}

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-[34px] w-[34px] flex-none items-center justify-center rounded-capsula",
        className
      )}
    >
      {children}
    </span>
  );
}

export function DiagnosticoPronto({
  professorId,
  atividade,
  todosTopicos,
  professor,
  plano,
}: {
  professorId: string;
  atividade: ActivityDetail;
  /** Tópicos dos módulos — o que o material tem além do que o quiz cobrou. */
  todosTopicos: string[];
  professor: Professor | null;
  plano: StudyPlan | null;
}) {
  // Agrupa as questões por tópico: é o único recorte que diz "por onde
  // começar", e ele sai da própria tentativa, sem depender do score global —
  // que depois de UMA tentativa ainda não classificou nada.
  const porTopico = new Map<string, { certas: number; total: number }>();
  for (const q of atividade.questions) {
    const atual = porTopico.get(q.topico) ?? { certas: 0, total: 0 };
    atual.total += 1;
    if (q.correta) atual.certas += 1;
    porTopico.set(q.topico, atual);
  }

  const linhas = [...porTopico.entries()]
    .map(([topico, { certas, total }]) => ({
      topico,
      pct: Math.round((certas / total) * 100),
      acertouTudo: certas === total,
    }))
    .sort((a, b) => a.pct - b.pct);

  const foco = linhas.find((l) => !l.acertouTudo) ?? null;
  const acertouTudo = linhas.filter((l) => l.acertouTudo);
  const restantes = linhas.filter((l) => !l.acertouTudo && l.topico !== foco?.topico);
  const naoVistos = todosTopicos.filter((t) => !porTopico.has(t));
  const dataProva = professor?.exam_dates ?? null;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-none">
        <p className="text-rotulo uppercase tracking-[0.06em] text-tinta-fraca">
          Diagnóstico · <MetricText tone="fraca">{atividade.questions.length}</MetricText> questões
        </p>
        <h1 className="mt-1.5 text-pretty text-titulo-estado">Já sei onde você está</h1>
      </div>

      <div className="mt-[18px] flex-none">
        <InsetList>
          {acertouTudo.map((l) => (
            <LinhaTopico
              key={l.topico}
              badge={
                <Badge className="bg-acerto text-papel">
                  <Check className="h-[18px] w-[18px]" strokeWidth={3} />
                </Badge>
              }
              titulo={l.topico}
              detalhe={
                <>
                  Você acertou tudo, <MetricText tone="fraca">{l.pct}%</MetricText> no diagnóstico
                </>
              }
            />
          ))}

          {foco && (
            <LinhaTopico
              destaque
              detalheIndigo
              badge={
                <Badge className="bg-indigo">
                  <MetricText tone="papel" weight="bold" className="text-[12px]">
                    {foco.pct}%
                  </MetricText>
                </Badge>
              }
              titulo={foco.topico}
              detalhe="É por aqui que a gente começa"
            />
          )}

          {restantes.map((l) => (
            <LinhaTopico
              key={l.topico}
              badge={
                <Badge className="bg-cinza-tonal">
                  <MetricText tone="fraca" weight="bold" className="text-[12px]">
                    {l.pct}%
                  </MetricText>
                </Badge>
              }
              titulo={l.topico}
              detalhe="Fica para depois do primeiro"
            />
          ))}

          {naoVistos.length > 0 && (
            <LinhaTopico
              badge={
                <Badge className="bg-cinza-tonal text-tinta-fraca">
                  <CircleDashed className="h-4 w-4" />
                </Badge>
              }
              titulo={
                naoVistos.length === 1
                  ? naoVistos[0]
                  : `${naoVistos[0]} e mais ${naoVistos.length - 1}`
              }
              detalhe="O diagnóstico não passou por eles ainda"
            />
          )}
        </InsetList>
      </div>

      <div className="mt-4 flex-none rounded-grupo bg-indigo/10 p-4 shadow-[inset_0_0_0_1px_hsl(var(--indigo)/0.16)]">
        <p className="flex items-center gap-[7px] text-[11px] font-semibold uppercase tracking-[0.06em] text-indigo">
          <Compass className="h-3.5 w-3.5" />
          {dataProva ? <>Seu plano · {dataProva}</> : "Seu plano de estudos"}
        </p>
        {plano ? (
          <p className="mt-2 text-pretty text-corpo leading-[1.5] text-tinta">
            {plano.content.resumo}
          </p>
        ) : (
          <p className="mt-2 text-pretty text-corpo leading-[1.5] text-tinta">
            O plano sai deste diagnóstico:{" "}
            <Link
              href={`/professor/${professorId}/plano`}
              className="font-semibold text-indigo hover:underline"
            >
              montar meu plano de estudos
            </Link>
            .
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-none items-center gap-3 rounded-cartao bg-white/70 p-3.5 shadow-hairline">
        <KangoPlaceholder px={52} />
        <p className="flex-1 text-[13.5px] leading-[1.5] text-tinta-fraca">
          &ldquo;Errar no diagnóstico é de graça, serviu pra eu saber o que te cobrar.&rdquo;
        </p>
      </div>

      <div className="min-h-3 flex-1" />

      {foco ? (
        <Link
          href={`/licao/${professorId}?topic=${encodeURIComponent(foco.topico)}&rotulo=${encodeURIComponent(foco.topico)}`}
          className={capsuleVariants("principal", true)}
        >
          <Play className="h-4 w-4 fill-current" />
          <span className="truncate">Começar por {foco.topico}</span>
        </Link>
      ) : (
        // Gabaritou o diagnóstico: não há ponto fraco para apontar, e mandar
        // repetir o mesmo tópico seria o contrário do que a tela diz.
        <Link href={`/professor/${professorId}`} className={capsuleVariants("principal", true)}>
          <Play className="h-4 w-4 fill-current" />
          Ver minha trilha
        </Link>
      )}

      {foco && (
        <Link
          href={`/professor/${professorId}`}
          className="mt-3 text-center text-corpo font-medium text-indigo hover:underline"
        >
          Ver minha trilha
        </Link>
      )}
    </div>
  );
}
