"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Sparkles } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Capsule } from "@/components/ui/capsule";
import { GlassCard } from "@/components/ui/glass-card";
import { InlineAlert } from "@/components/ui/inline-alert";
import { MetricText } from "@/components/ui/metric-text";
import { cn } from "@/lib/utils";
import type { PlanId } from "@/lib/types";

/*
  Tela de assinatura — planos + checkout Stripe (trial de 7 dias nativo do
  Stripe, sem cobrar nada até o trial acabar).

  Não trava nada ainda: quem não assina continua usando o app normalmente.
  Isso é de propósito (decisão do usuário em 2026-09-07) — o gate de acesso
  vem depois, com calma.
*/

const PLANOS: { id: PlanId; nome: string; preco: number; destaque?: boolean; descricao: string }[] = [
  {
    id: "basico",
    nome: "Básico",
    preco: 39.9,
    descricao: "Quiz ilimitado, trilha por matéria, calendário e plano de estudos.",
  },
  {
    id: "pro",
    nome: "Pro",
    preco: 89.9,
    destaque: true,
    descricao: "Tudo do Básico, prioridade nas novidades que vêm por aí.",
  },
  {
    id: "kango",
    nome: "Kango",
    preco: 129.9,
    descricao: "Tudo do Pro, apoia o desenvolvimento do app direto.",
  },
];

export default function AssinaturaPage() {
  return (
    <Suspense>
      <AssinaturaConteudo />
    </Suspense>
  );
}

function AssinaturaConteudo() {
  const search = useSearchParams();
  const [carregando, setCarregando] = useState<PlanId | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function assinar(plan: PlanId) {
    setErro(null);
    setCarregando(plan);
    try {
      const { url } = await api.criarCheckout(plan);
      window.location.href = url;
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível iniciar o checkout.");
      setCarregando(null);
    }
  }

  return (
    <div className="mx-auto max-w-[720px]">
      <PageHeader title="Assinatura" />

      {search.get("cancelado") === "1" && (
        <InlineAlert className="mb-4">Checkout cancelado — nada foi cobrado.</InlineAlert>
      )}

      <GlassCard nivel="cartao" radius="grupo" className="mb-[22px] flex items-center gap-3 p-4">
        <Sparkles className="h-5 w-5 flex-none text-indigo" />
        <p className="text-nota text-tinta-fraca">
          <MetricText weight="bold">7 dias grátis</MetricText> em qualquer plano. Cancela quando
          quiser antes do trial acabar e não paga nada.
        </p>
      </GlassCard>

      {erro && (
        <InlineAlert className="mb-4">{erro}</InlineAlert>
      )}

      <div className="flex flex-col gap-4">
        {PLANOS.map((plano) => (
          <GlassCard
            key={plano.id}
            nivel="cartao"
            radius="grupo"
            className={cn("p-4", plano.destaque && "shadow-[0_0_0_2px_hsl(var(--indigo))]")}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-titulo-cartao text-tinta">{plano.nome}</p>
                  {plano.destaque && (
                    <span className="rounded-capsula bg-indigo/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.04em] text-indigo">
                      Mais popular
                    </span>
                  )}
                </div>
                <p className="mt-1 text-nota text-tinta-fraca">{plano.descricao}</p>
              </div>
              <div className="flex-none text-right">
                <MetricText className="text-[22px] font-bold text-tinta">
                  R${plano.preco.toFixed(2).replace(".", ",")}
                </MetricText>
                <p className="text-[11px] text-tinta-fraca">/mês</p>
              </div>
            </div>

            <Capsule
              block
              className="mt-4"
              loading={carregando === plano.id}
              disabled={carregando !== null && carregando !== plano.id}
              onClick={() => assinar(plano.id)}
            >
              <Check className="h-[17px] w-[17px]" />
              Começar trial de 7 dias
            </Capsule>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
