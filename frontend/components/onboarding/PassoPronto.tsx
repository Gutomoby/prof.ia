"use client";

import { Bell, BellOff, Check, Play } from "lucide-react";
import { Capsule } from "@/components/ui/capsule";
import { InsetList, InsetRow } from "@/components/ui/inset-list";
import { KangoPlaceholder } from "@/components/ui/kango-placeholder";
import { MetricText } from "@/components/ui/metric-text";
import { PassoHeader } from "@/components/onboarding/PassoHeader";
import { professorColor } from "@/lib/professor-color";
import type { Professor } from "@/lib/types";

/*
  Tela 10 · Professor pronto (3 de 3).

  O resumo só afirma o que foi contado de verdade nesta sessão: quantos
  arquivos entraram e quantos tópicos vieram dos módulos. As páginas do
  desenho ("Li 2 arquivos · 34 páginas") ficaram de fora porque DocumentItem
  não tem contagem de páginas — é o item 5 do consolidado de backend.

  A terceira linha era um interruptor de lembrete às 20:00. Como não há
  agendamento nenhum (ver PassoNotificacoes), ela virou o que existe: o
  estado da permissão do navegador. Interruptor que não agenda nada seria a
  única linha mentirosa da tela.
*/
export function PassoPronto({
  professor,
  nArquivos,
  nTopicos,
  notificacoes,
  onDiagnostico,
  onDepois,
  gerando,
}: {
  professor: Professor;
  nArquivos: number;
  nTopicos: number;
  /** Permissão do navegador no fim do passo 09. */
  notificacoes: NotificationPermission | null;
  onDiagnostico: () => void;
  onDepois: () => void;
  gerando: boolean;
}) {
  const cor = professorColor(professor.id);
  const ligadas = notificacoes === "granted";

  return (
    <div className="flex flex-1 flex-col items-center">
      <div className="w-full flex-none">
        <PassoHeader passo={3} />
      </div>

      <div className="flex w-full flex-1 flex-col items-center justify-center">
        <KangoPlaceholder px={124} estado="com livro" />

        <h1 className="mt-[22px] text-pretty text-center text-titulo-estado">
          Pronto. Já sei sua matéria.
        </h1>

        <p className="mt-2.5 flex items-center gap-[7px] text-[14px] text-tinta-fraca">
          <span aria-hidden className={`h-2 w-2 flex-none rounded-capsula ${cor.bg}`} />
          <span className="truncate">
            {professor.name} · {professor.discipline}
          </span>
        </p>

        <div className="mt-[22px] w-full">
          <InsetList>
            <InsetRow
              icon={<Check strokeWidth={3} />}
              iconTone="acerto"
              title={
                <>
                  Li <MetricText weight="bold">{nArquivos}</MetricText>{" "}
                  {nArquivos === 1 ? "arquivo" : "arquivos"} do seu material
                </>
              }
            />
            {/* A linha só existe quando os módulos vieram. Se a organização
                falhou, "Achei 0 tópicos" seria uma afirmação errada sobre o
                material — melhor não dizer nada. */}
            {nTopicos > 0 && (
              <InsetRow
                icon={<Check strokeWidth={3} />}
                iconTone="acerto"
                title={
                  <>
                    Achei <MetricText weight="bold">{nTopicos}</MetricText>{" "}
                    {nTopicos === 1 ? "tópico" : "tópicos"} para cobrar de você
                  </>
                }
              />
            )}
            <InsetRow
              altura={ligadas ? "simples" : "dupla"}
              icon={ligadas ? <Bell /> : <BellOff />}
              iconTone={ligadas ? "indigo" : "inativo"}
              title={ligadas ? "Aviso neste navegador, ligado" : "Aviso neste navegador, desligado"}
              subtitle={ligadas ? undefined : "Dá para ligar depois, nas permissões do navegador"}
              trailing={
                ligadas ? <Check className="h-[18px] w-[18px] text-acerto" strokeWidth={3} /> : null
              }
            />
          </InsetList>
        </div>

        <p className="mt-3 max-w-[300px] text-center text-nota leading-[1.45] text-tinta-fraca">
          O diagnóstico são <MetricText tone="fraca">5</MetricText> a{" "}
          <MetricText tone="fraca">8</MetricText> questões para ele descobrir onde você está.
        </p>
      </div>

      <div className="w-full flex-none">
        <Capsule block loading={gerando} onClick={onDiagnostico}>
          {!gerando && <Play className="h-4 w-4 fill-current" />}
          Fazer o diagnóstico
        </Capsule>
        <Capsule variant="texto" block className="mt-3" onClick={onDepois}>
          Só olhar o app primeiro
        </Capsule>
      </div>
    </div>
  );
}
