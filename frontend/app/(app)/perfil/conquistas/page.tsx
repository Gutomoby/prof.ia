"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { InlineAlert } from "@/components/ui/inline-alert";
import { InsetList } from "@/components/ui/inset-list";
import { MetricText } from "@/components/ui/metric-text";
import { Skeleton } from "@/components/ui/skeleton";
import { CATALOGO } from "@/components/perfil/catalogo-conquistas";
import { cn } from "@/lib/utils";
import type { Achievement } from "@/lib/types";

/*
  Tela 34 · Todas as conquistas.

  As medalhas são derivadas do histórico a cada leitura (services/achievements.py):
  não há tabela de conquistas, e por isso também não há "conquista nova" a
  comemorar aqui — quem já tinha 7 dias seguidos em julho aparece com a data
  de julho, não com a de hoje.

  A tela é a mesma do handoff em três blocos: o "falta pouco" (a mais perto de
  sair), as ganhas com a data, e as a caminho. O que muda é o contador: sete e
  não nove, porque sete é quantas o design nomeia — ver o catálogo.

  "Falta pouco" só aparece quando há progresso de verdade. Com tudo zerado o
  cartão diria "0 de 7 dias" com destaque de quase-lá, que é o contrário do
  que ele existe para dizer.
*/

function Disco({
  children,
  className,
  px = 38,
}: {
  children: React.ReactNode;
  className?: string;
  px?: number;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex flex-none items-center justify-center rounded-capsula text-papel",
        className
      )}
      style={{ width: px, height: px }}
    >
      {children}
    </span>
  );
}

function dataCurta(iso: string) {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}

export default function ConquistasPage() {
  const [items, setItems] = useState<Achievement[] | null>(null);
  const [ganhas, setGanhas] = useState(0);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    api
      .listConquistas()
      .then((res) => {
        setItems(res.items);
        setGanhas(res.ganhas);
      })
      .catch(() => setErro("Não foi possível carregar as conquistas."));
  }, []);

  const conquistadas = items?.filter((c) => c.ganha) ?? [];
  const aCaminho = items?.filter((c) => !c.ganha) ?? [];

  // A mais perto de sair: maior fração do alvo, e só se já saiu do zero.
  const faltaPouco = aCaminho
    .filter((c) => c.atual > 0)
    .sort((a, b) => b.atual / b.alvo - a.atual / a.alvo)[0];

  return (
    <div className="mx-auto max-w-[560px]">
      <PageHeader
        title="Conquistas"
        backHref="/perfil"
        backLabel="Perfil"
        subtitle={
          items ? (
            <>
              <MetricText weight="bold">{ganhas}</MetricText> de{" "}
              <MetricText tone="fraca">{items.length}</MetricText> · todas saem de sequência,
              domínio e acerto
            </>
          ) : undefined
        }
      />

      {erro && <InlineAlert>{erro}</InlineAlert>}

      {!items && !erro && (
        <div className="flex flex-col gap-[22px]">
          <Skeleton className="h-[110px] rounded-grupo" />
          <Skeleton className="h-[190px] rounded-grupo" />
        </div>
      )}

      {items && (
        <div className="flex flex-col gap-[22px]">
          {faltaPouco && (
            <div className="rounded-grupo bg-indigo/10 p-4 shadow-[inset_0_0_0_1px_hsl(var(--indigo)/0.16)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-indigo">
                Falta pouco
              </p>
              <div className="mt-2 flex items-center gap-3.5">
                <Disco px={46} className="bg-indigo">
                  {(() => {
                    const Icone = CATALOGO[faltaPouco.id]?.icone;
                    return Icone ? <Icone className="h-[22px] w-[22px]" /> : null;
                  })()}
                </Disco>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-linha font-semibold">
                    {CATALOGO[faltaPouco.id]?.nome ?? faltaPouco.id}
                  </p>
                  <div
                    role="progressbar"
                    aria-valuenow={faltaPouco.atual}
                    aria-valuemin={0}
                    aria-valuemax={faltaPouco.alvo}
                    className="mt-[7px] h-[7px] overflow-hidden rounded-capsula bg-borda"
                  >
                    <div
                      className="h-full rounded-capsula bg-indigo transition-[width] duration-400 ease-out"
                      style={{ width: `${(faltaPouco.atual / faltaPouco.alvo) * 100}%` }}
                    />
                  </div>
                  <p className="mt-[5px] text-nota text-tinta">
                    <MetricText weight="bold">{faltaPouco.atual}</MetricText> de{" "}
                    <MetricText>{faltaPouco.alvo}</MetricText>{" "}
                    {CATALOGO[faltaPouco.id]?.unidade}
                  </p>
                </div>
              </div>
            </div>
          )}

          {conquistadas.length > 0 && (
            <div>
              <p className="mb-2 px-rotulo-secao text-rotulo uppercase text-tinta-fraca">Ganhas</p>
              <InsetList>
                {conquistadas.map((c) => {
                  const copy = CATALOGO[c.id];
                  const Icone = copy?.icone;
                  return (
                    <div
                      key={c.id}
                      className="relative flex min-h-[62px] items-center gap-3 px-4"
                    >
                      <Disco className={copy?.cor ?? "bg-indigo"}>
                        {Icone && <Icone className="h-[19px] w-[19px]" />}
                      </Disco>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[16px] font-semibold tracking-[-0.43px]">
                          {copy?.nome ?? c.id}
                        </p>
                        <p className="truncate text-nota text-tinta-fraca">{copy?.frase}</p>
                      </div>
                      {c.data && (
                        <MetricText tone="fraca" className="flex-none text-[12px]">
                          {dataCurta(c.data)}
                        </MetricText>
                      )}
                      <span
                        aria-hidden
                        data-sep
                        className="pointer-events-none absolute bottom-0 left-[66px] right-0 h-[0.5px] bg-borda"
                      />
                    </div>
                  );
                })}
              </InsetList>
            </div>
          )}

          {aCaminho.length > 0 && (
            <div>
              <p className="mb-2 px-rotulo-secao text-rotulo uppercase text-tinta-fraca">
                A caminho
              </p>
              {/* Vidro mais fraco e hairline no lugar da sombra: o grupo do que
                  ainda não aconteceu não pode ter o mesmo peso do que já é seu. */}
              <div className="overflow-hidden rounded-grupo bg-white/[0.62] shadow-hairline [&>*:last-child_[data-sep]]:hidden">
                {aCaminho.map((c) => {
                  const copy = CATALOGO[c.id];
                  const Icone = copy?.icone;
                  return (
                    <div
                      key={c.id}
                      className="relative flex min-h-[58px] items-center gap-3 px-4"
                    >
                      <Disco className="bg-cinza-tonal text-tinta-fraca">
                        {Icone && <Icone className="h-[18px] w-[18px]" />}
                      </Disco>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[16px] tracking-[-0.43px] text-tinta/80">
                          {copy?.nome ?? c.id}
                        </p>
                        <p className="truncate text-nota text-tinta-fraca">
                          {c.atual > 0 ? (
                            <>
                              <MetricText tone="fraca">{c.atual}</MetricText> de{" "}
                              <MetricText tone="fraca">{c.alvo}</MetricText> {copy?.unidade}
                            </>
                          ) : (
                            copy?.frase
                          )}
                        </p>
                      </div>
                      <span
                        aria-hidden
                        data-sep
                        className="pointer-events-none absolute bottom-0 left-[66px] right-0 h-[0.5px] bg-borda"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
