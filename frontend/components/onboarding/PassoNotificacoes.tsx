"use client";

import { useState } from "react";
import { BellRing } from "lucide-react";
import { Capsule } from "@/components/ui/capsule";
import { MetricText } from "@/components/ui/metric-text";

/*
  Tela 09 · Permitir notificações.

  O botão pede a permissão de verdade ao navegador (Notification.requestPermission),
  e é só isso que ele faz. O lembrete diário das 20:00 ainda não existe: não há
  reminderTime/reminderEnabled em lugar nenhum do backend nem serviço de push
  (item 7 do consolidado no plano, e o mesmo motivo pelo qual a tela 35 não
  mostra o controle de lembrete). A permissão é a metade que dá para entregar
  hoje, e é a que fica guardada no navegador — quando o push existir, ninguém
  vai ser perguntado duas vezes.

  Por isso o passo se anuncia sozinho e some quando não há o que pedir: em
  navegador sem Notification, ou quando a pessoa já respondeu antes, o fluxo
  pula direto para a tela 10 (ver podePedirNotificacao).

  O cartão é a prévia do push, um desenho — não dispara notificação nenhuma
  com esse texto. Notificação de exemplo com número inventado seria pior que
  nenhuma.
*/

/** Só faz sentido mostrar a tela 09 quando há permissão a pedir. */
export function podePedirNotificacao() {
  return typeof window !== "undefined" && "Notification" in window && Notification.permission === "default";
}

export function PassoNotificacoes({ onResolver }: { onResolver: () => void }) {
  const [pedindo, setPedindo] = useState(false);

  async function permitir() {
    setPedindo(true);
    try {
      await Notification.requestPermission();
    } catch {
      // Navegador que recusa o pedido (contexto inseguro, por exemplo) não
      // trava o fluxo: o passo é opcional do começo ao fim.
    } finally {
      setPedindo(false);
      onResolver();
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center">
      <div className="flex w-full flex-1 flex-col items-center justify-center">
        <span className="flex h-[66px] w-[66px] items-center justify-center rounded-[22px] bg-indigo/12 text-indigo">
          <BellRing className="h-8 w-8" />
        </span>

        <h1 className="mt-5 text-pretty text-center text-titulo-estado">Ative as notificações</h1>
        <p className="mt-2.5 max-w-[330px] text-pretty text-center text-corpo text-tinta-fraca">
          Um lembrete por dia para você não perder a lição nem a sequência. Também aviso quando o
          material termina de ser lido e quando a prova chega perto.
        </p>

        <div className="mt-6 flex w-full items-start gap-3 rounded-cartao bg-white/[0.92] p-3.5 shadow-[inset_0_0_0_1px_hsl(var(--borda)),0_10px_30px_rgba(20,20,30,.10)]">
          <span
            aria-hidden
            className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[10px] bg-indigo text-corpo font-bold text-papel"
          >
            K
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <p className="text-[14px] font-semibold">KANGO</p>
              <MetricText tone="fraca" className="ml-auto text-[11.5px]">
                agora
              </MetricText>
            </div>
            <p className="mt-[3px] text-[14px] leading-[1.4]">
              Falta a lição de hoje: Tábuas de Mortalidade, <MetricText>5</MetricText> questões em{" "}
              <MetricText>3</MetricText> min. Sua sequência está em <MetricText>5</MetricText> dias.
            </p>
          </div>
        </div>
        <p className="mt-2.5 text-center text-[12.5px] text-tinta-fraca">
          É assim que ela aparece. O horário você escolhe depois, nas configurações.
        </p>
      </div>

      <div className="flex w-full flex-none flex-col items-center gap-3">
        <Capsule block loading={pedindo} onClick={permitir}>
          Permitir notificações
        </Capsule>
        <Capsule variant="texto" onClick={onResolver} className="text-tinta-fraca">
          Agora não
        </Capsule>
      </div>
    </div>
  );
}
