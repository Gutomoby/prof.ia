"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { GlassCard } from "@/components/ui/glass-card";
import { Skeleton } from "@/components/ui/skeleton";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Capsule } from "@/components/ui/capsule";
import { Pill, type PillTone } from "@/components/ui/pill";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Segmented } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";
import { api, ApiError } from "@/lib/api";
import type { PlanId, SubscriptionRow, SubscriptionStatus } from "@/lib/types";

/*
  Painel admin de assinaturas — v1 sem checkout/webhook. A cobrança acontece
  fora do app (Pix/Mercado Pago); esta tela só registra o que o admin já
  cobrou, pra alimentar os números reais de /admin/financeiro.
*/

const PLAN_LABELS: Record<PlanId, string> = { basico: "Básico", pro: "Pro", kango: "Kango" };
const PLAN_PRICES: Record<PlanId, number> = { basico: 39.9, pro: 89.9, kango: 129.9 };
const PLAN_OPTIONS = (Object.keys(PLAN_LABELS) as PlanId[]).map((id) => ({
  value: id,
  label: PLAN_LABELS[id],
}));
const STATUS_OPTIONS: { value: SubscriptionStatus; label: string }[] = [
  { value: "active", label: "Ativo" },
  { value: "canceled", label: "Cancelado" },
];

function tonePlano(plan: PlanId | null): PillTone {
  return plan ? "indigo" : "neutro";
}

function toneStatus(status: SubscriptionStatus | null): PillTone {
  if (status === "active") return "acerto";
  if (status === "canceled") return "erro";
  return "neutro";
}

export default function AssinaturasPage() {
  const [items, setItems] = useState<SubscriptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState("");

  const [editando, setEditando] = useState<SubscriptionRow | null>(null);
  const [plano, setPlano] = useState<PlanId>("basico");
  const [status, setStatus] = useState<SubscriptionStatus>("active");
  const [preco, setPreco] = useState(PLAN_PRICES.basico);
  const [vence, setVence] = useState("");
  const [notas, setNotas] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listAssinaturas({ limit: 500 });
      setItems(res.items);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 403
          ? "Esta área é restrita a administradores."
          : "Erro ao carregar assinaturas"
      );
    } finally {
      setLoading(false);
    }
  }

  function abrirEdicao(row: SubscriptionRow) {
    setEditando(row);
    const planoInicial = row.plan ?? "basico";
    setPlano(planoInicial);
    setStatus(row.status ?? "active");
    setPreco(row.price_brl ?? PLAN_PRICES[planoInicial]);
    setVence(row.period_end ?? "");
    setNotas(row.notes ?? "");
    setErroSalvar(null);
  }

  function trocarPlano(novoPlano: PlanId) {
    setPlano(novoPlano);
    setPreco(PLAN_PRICES[novoPlano]);
  }

  async function salvar() {
    if (!editando) return;
    setSalvando(true);
    setErroSalvar(null);
    try {
      const atualizado = await api.setAssinatura(editando.user_id, {
        plan: plano,
        status,
        price_brl: preco,
        notes: notas.trim() || null,
        period_end: vence || null,
      });
      setItems((prev) =>
        prev.map((item) => (item.user_id === editando.user_id ? { ...item, ...atualizado } : item))
      );
      setEditando(null);
    } catch (err) {
      setErroSalvar(err instanceof ApiError ? err.message : "Erro ao salvar a assinatura");
    } finally {
      setSalvando(false);
    }
  }

  const filtrados = items.filter((item) => {
    const alvo = `${item.email ?? ""} ${item.full_name ?? ""}`.toLowerCase();
    return alvo.includes(filtro.trim().toLowerCase());
  });

  if (loading) {
    return (
      <div className="mx-auto max-w-[1400px]">
        <PageHeader title="Assinaturas" />
        <Skeleton className="h-[400px] rounded-grupo" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-[1400px]">
        <PageHeader title="Assinaturas" />
        <InlineAlert>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            <Capsule variant="secundaria" onClick={load}>
              Tentar novamente
            </Capsule>
          </div>
        </InlineAlert>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title="Assinaturas" />

      <div className="mb-4 max-w-sm">
        <Input
          placeholder="Buscar por e-mail ou nome..."
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
        />
      </div>

      <GlassCard nivel="cartao" radius="grupo" className="p-4">
        {filtrados.length === 0 ? (
          <p className="text-nota text-tinta-fraca">Nenhum usuário encontrado</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-corpo">
              <thead>
                <tr className="border-b border-borda">
                  <th className="px-3 py-2 text-left text-nota font-semibold text-tinta-fraca">E-mail</th>
                  <th className="px-3 py-2 text-left text-nota font-semibold text-tinta-fraca">Nome</th>
                  <th className="px-3 py-2 text-left text-nota font-semibold text-tinta-fraca">Plano</th>
                  <th className="px-3 py-2 text-left text-nota font-semibold text-tinta-fraca">Status</th>
                  <th className="px-3 py-2 text-right text-nota font-semibold text-tinta-fraca">Valor</th>
                  <th className="px-3 py-2 text-left text-nota font-semibold text-tinta-fraca">Vence em</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {filtrados.map((item) => (
                  <tr key={item.user_id} className="border-b border-borda/50 hover:bg-indigo/5">
                    <td className="px-3 py-3 text-tinta">{item.email ?? "—"}</td>
                    <td className="px-3 py-3 text-tinta-fraca">{item.full_name ?? "—"}</td>
                    <td className="px-3 py-3">
                      <Pill tone={tonePlano(item.plan)}>{item.plan ? PLAN_LABELS[item.plan] : "sem plano"}</Pill>
                    </td>
                    <td className="px-3 py-3">
                      <Pill tone={toneStatus(item.status)}>
                        {item.status === "active" ? "Ativo" : item.status === "canceled" ? "Cancelado" : "—"}
                      </Pill>
                    </td>
                    <td className="px-3 py-3 text-right text-tinta">
                      {item.price_brl != null ? `R$${item.price_brl.toFixed(2)}` : "—"}
                    </td>
                    <td className="px-3 py-3 text-tinta-fraca">{item.period_end ?? "—"}</td>
                    <td className="px-3 py-3 text-right">
                      <Capsule variant="secundaria" onClick={() => abrirEdicao(item)}>
                        Editar
                      </Capsule>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      <Sheet aberta={editando !== null} onFechar={() => setEditando(null)} titulo="Editar assinatura">
        {editando && (
          <div className="flex flex-col gap-4 pb-2">
            <div>
              <p className="text-titulo-estado">{editando.email ?? editando.user_id}</p>
              {editando.full_name && <p className="text-nota text-tinta-fraca">{editando.full_name}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-nota font-semibold text-tinta-fraca">Plano</label>
              <Segmented options={PLAN_OPTIONS} value={plano} onValueChange={trocarPlano} />
            </div>

            <div>
              <label className="mb-1.5 block text-nota font-semibold text-tinta-fraca">Status</label>
              <Segmented options={STATUS_OPTIONS} value={status} onValueChange={setStatus} />
            </div>

            <div>
              <label className="mb-1.5 block text-nota font-semibold text-tinta-fraca">Valor mensal (R$)</label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={preco}
                onChange={(e) => setPreco(Number(e.target.value))}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-nota font-semibold text-tinta-fraca">Vence em</label>
              <Input type="date" value={vence} onChange={(e) => setVence(e.target.value)} />
            </div>

            <div>
              <label className="mb-1.5 block text-nota font-semibold text-tinta-fraca">Observações</label>
              <Textarea
                placeholder="Ex.: pago via Pix em 22/08, referência do Mercado Pago..."
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
              />
            </div>

            {erroSalvar && (
              <p className="text-nota text-erro" role="alert">
                {erroSalvar}
              </p>
            )}

            <Capsule block loading={salvando} onClick={salvar}>
              Salvar assinatura
            </Capsule>
          </div>
        )}
      </Sheet>
    </div>
  );
}
