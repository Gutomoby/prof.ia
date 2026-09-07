"use client";

import { useEffect, useState } from "react";
import { ChevronRight, CreditCard, Wallet } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Capsule } from "@/components/ui/capsule";
import { InlineAlert } from "@/components/ui/inline-alert";
import { InsetList, InsetRow } from "@/components/ui/inset-list";
import { PageHeader } from "@/components/layout/PageHeader";
import { GlassCard } from "@/components/ui/glass-card";
import { MetricText } from "@/components/ui/metric-text";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

interface Metrics {
  total_tokens: number;
  total_cost_usd: number;
  unique_users: number;
  avg_cost_per_user_month: number;
  operations_by_model: Record<string, number>;
  cost_by_model: Record<string, number>;
  projected_annual_cost: number;
}

interface CostTrend {
  date: string;
  tokens: number;
  cost: number;
}

export default function AdminPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [trends, setTrends] = useState<CostTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      // Via api.request: prefixa a URL do backend (sem isso o fetch ia para o
      // próprio Next.js e voltava 404) e manda o header de autenticação, que
      // estas rotas agora exigem.
      const [metricsRes, trendsRes] = await Promise.all([
        api.request<Metrics>("/admin/metrics"),
        api.request<{ items: CostTrend[] }>("/admin/costs/trend?days=30"),
      ]);

      setMetrics(metricsRes);
      setTrends(trendsRes.items || []);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 403
          ? "Esta área é restrita a administradores."
          : err instanceof Error
            ? err.message
            : "Erro ao carregar métricas"
      );
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-[1200px]">
        <PageHeader title="Admin" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-[100px] rounded-grupo" />
          <Skeleton className="h-[100px] rounded-grupo" />
          <Skeleton className="h-[100px] rounded-grupo" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-[1200px]">
        <PageHeader title="Admin" />
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

  const modelData = metrics?.operations_by_model
    ? Object.entries(metrics.operations_by_model).map(([model, ops]) => ({
        model,
        operacoes: ops,
        custo: metrics.cost_by_model?.[model] || 0,
      }))
    : [];

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader title="Painel de Admin" />

      {/* Financeiro e Assinaturas existem como telas próprias, mas nada aqui
          levava até elas — dava pra chegar só digitando a URL de cor. */}
      <div className="mb-[22px]">
        <InsetList>
          <InsetRow
            href="/admin/financeiro"
            icon={<Wallet />}
            iconTone="acerto"
            title="Financeiro"
            subtitle="Receita, margem e custo por usuário"
            trailing={<ChevronRight className="h-[18px] w-[18px]" />}
          />
          <InsetRow
            href="/admin/assinaturas"
            icon={<CreditCard />}
            iconTone="indigo"
            title="Assinaturas"
            subtitle="Planos ativos por usuário"
            trailing={<ChevronRight className="h-[18px] w-[18px]" />}
          />
        </InsetList>
      </div>

      {/* Resumo geral */}
      <div className="mb-[22px] grid gap-4 md:grid-cols-3">
        <GlassCard nivel="cartao" radius="grupo" className="p-4">
          <p className="text-nota text-tinta-fraca">Total de Tokens (30 dias)</p>
          <p className="mt-2 text-[28px] font-bold text-tinta">
            <MetricText>{(metrics?.total_tokens || 0) / 1000000}M</MetricText>
          </p>
        </GlassCard>

        <GlassCard nivel="cartao" radius="grupo" className="p-4">
          <p className="text-nota text-tinta-fraca">Custo Total (30 dias)</p>
          <p className="mt-2 text-[28px] font-bold text-tinta">
            <MetricText>${(metrics?.total_cost_usd || 0).toFixed(2)}</MetricText>
          </p>
          <p className="mt-1 text-nota text-tinta-fraca">
            Projeção anual: ${(metrics?.projected_annual_cost || 0).toFixed(2)}
          </p>
        </GlassCard>

        <GlassCard nivel="cartao" radius="grupo" className="p-4">
          <p className="text-nota text-tinta-fraca">Usuários Únicos</p>
          <p className="mt-2 text-[28px] font-bold text-tinta">
            <MetricText>{metrics?.unique_users || 0}</MetricText>
          </p>
          <p className="mt-1 text-nota text-tinta-fraca">
            Custo/mês/usuário: ${(metrics?.avg_cost_per_user_month || 0).toFixed(2)}
          </p>
        </GlassCard>
      </div>

      {/* Gráfico de tendência de custo */}
      {trends.length > 0 && (
        <GlassCard nivel="cartao" radius="grupo" className="mb-[22px] p-4">
          <p className="mb-4 text-corpo font-bold text-tinta">Custo Diário (últimos 30 dias)</p>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={trends}>
              <defs>
                <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--indigo))" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="hsl(var(--indigo))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--borda))" />
              <XAxis dataKey="date" stroke="hsl(var(--tinta-fraca))" tick={{ fontSize: 12 }} />
              <YAxis stroke="hsl(var(--tinta-fraca))" tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: any) => `$${Number(v).toFixed(2)}`} />
              <Area type="monotone" dataKey="cost" stroke="hsl(var(--indigo))" fill="url(#colorCost)" />
            </AreaChart>
          </ResponsiveContainer>
        </GlassCard>
      )}

      {/* Custo por modelo — eixos separados: operações é contagem (dezenas),
          custo é dólares (centavos). Na mesma escala o custo sumia do gráfico. */}
      {modelData.length > 0 && (
        <GlassCard nivel="cartao" radius="grupo" className="mb-[22px] p-4">
          <p className="mb-4 text-corpo font-bold text-tinta">Operações por Modelo</p>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={modelData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--borda))" />
              <XAxis dataKey="model" stroke="hsl(var(--tinta-fraca))" />
              <YAxis yAxisId="operacoes" stroke="hsl(var(--tinta-fraca))" />
              <YAxis
                yAxisId="custo"
                orientation="right"
                stroke="hsl(var(--tinta-fraca))"
                tickFormatter={(v) => `$${Number(v).toFixed(2)}`}
              />
              <Tooltip formatter={(v: number, nome) => (nome === "custo" ? `$${v.toFixed(4)}` : v)} />
              <Legend />
              <Bar yAxisId="operacoes" dataKey="operacoes" fill="hsl(var(--indigo))" />
              <Bar yAxisId="custo" dataKey="custo" fill="hsl(var(--acerto))" />
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>
      )}

      {/* Detalhe por modelo — dinâmico a partir dos dados reais, em vez de um
          texto fixo sobre qual modelo é o padrão (o Gemini já foi o padrão de
          quiz, mas o gemini-2.0-flash foi desativado pelo Google em 01/06/2026
          e o fallback Haiku assumiu 100% silenciosamente — removido em 2026-09-07). */}
      {modelData.length > 0 && (
        <GlassCard nivel="cartao" radius="grupo" className="p-4">
          <p className="mb-3 text-corpo font-bold text-tinta">Detalhe por Modelo</p>
          <div className="flex flex-col gap-3">
            {modelData.map((m) => (
              <div key={m.model} className="flex items-center justify-between">
                <div>
                  <p className="text-nota font-bold text-tinta">{m.model}</p>
                  <p className="text-nota text-tinta-fraca">{m.operacoes} operações</p>
                </div>
                <MetricText weight="bold">
                  ${m.operacoes > 0 ? (m.custo / m.operacoes).toFixed(4) : "0.0000"}/op
                </MetricText>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
