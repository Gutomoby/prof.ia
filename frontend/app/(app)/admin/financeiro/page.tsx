"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Segmented } from "@/components/ui/segmented";
import { GlassCard } from "@/components/ui/glass-card";
import { MetricText } from "@/components/ui/metric-text";
import { Skeleton } from "@/components/ui/skeleton";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Capsule } from "@/components/ui/capsule";
import { PageHeader } from "@/components/layout/PageHeader";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const CORES = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

interface Resumo {
  usuarios: { ativos: number; inativos: number; assinantes: number; total: number };
  financeiro: { receita_total: number; custo_total: number; margem: number; margem_pct: number };
  periodo_dias: number;
}

interface KPIs {
  usuarios_ativos: number;
  churn_rate_pct: number;
  ltv: number;
  uso_medio_tokens: number;
  custo_mensal: number;
  receita_mensal: number;
  financiadores: number;
  custo_medio_usuario: number;
}

interface UsuarioItem {
  user_id: string;
  custo_total: number;
  tokens_total: number;
  operacoes: number;
}

export default function FinanceiroPage() {
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [usuarios, setUsuarios] = useState<UsuarioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aba, setAba] = useState<"resumo" | "usuarios" | "custos" | "kpis">("resumo");
  const [dias, setDias] = useState(30);

  useEffect(() => {
    load();
  }, [dias]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [resumoRes, kpisRes, usuariosRes] = await Promise.all([
        fetch(`${API_URL}/admin/financeiro/resumo?dias=${dias}`).then((r) => r.json()),
        fetch(`${API_URL}/admin/financeiro/kpis?dias=${dias}`).then((r) => r.json()),
        fetch(`${API_URL}/admin/financeiro/usuarios?dias=${dias}`).then((r) => r.json()),
      ]);
      setResumo(resumoRes);
      setKpis(kpisRes);
      setUsuarios(usuariosRes.items || []);
    } catch (err) {
      setError("Erro ao carregar dados financeiros");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-[1400px]">
        <PageHeader title="Financeiro" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[100px] rounded-grupo" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-[1400px]">
        <PageHeader title="Financeiro" />
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
      <PageHeader title="Painel Financeiro" />

      {/* Filtro de período */}
      <div className="mb-6">
        <label className="text-nota text-tinta-fraca">Período:</label>
        <Segmented
          value={dias.toString()}
          onValueChange={(v) => setDias(parseInt(v))}
          options={[
            { value: "7", label: "7 dias" },
            { value: "30", label: "30 dias" },
            { value: "90", label: "90 dias" },
          ]}
        />
      </div>

      {/* Cards de resumo */}
      {resumo && (
        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <GlassCard nivel="cartao" radius="grupo" className="p-4">
            <p className="text-nota text-tinta-fraca">Ativos</p>
            <p className="mt-2 text-[28px] font-bold text-tinta">
              <MetricText>{resumo.usuarios.ativos}</MetricText>
            </p>
            <p className="mt-1 text-nota text-tinta-fraca">Inativos: {resumo.usuarios.inativos}</p>
          </GlassCard>

          <GlassCard nivel="cartao" radius="grupo" className="p-4">
            <p className="text-nota text-tinta-fraca">Assinantes</p>
            <p className="mt-2 text-[28px] font-bold text-tinta">
              <MetricText>{resumo.usuarios.assinantes}</MetricText>
            </p>
            <p className="mt-1 text-nota text-tinta-fraca">Total: {resumo.usuarios.total}</p>
          </GlassCard>

          <GlassCard nivel="cartao" radius="grupo" className="p-4">
            <p className="text-nota text-tinta-fraca">Receita ({dias}d)</p>
            <p className="mt-2 text-[28px] font-bold text-tinta">
              <MetricText>${resumo.financeiro.receita_total.toFixed(2)}</MetricText>
            </p>
            <p className="mt-1 text-nota text-tinta-fraca">Ano: ${(resumo.financeiro.receita_total * 365 / dias).toFixed(2)}</p>
          </GlassCard>

          <GlassCard nivel="cartao" radius="grupo" className="p-4">
            <p className="text-nota text-tinta-fraca">Margem</p>
            <p className={`mt-2 text-[28px] font-bold ${resumo.financeiro.margem >= 0 ? "text-acerto" : "text-erro"}`}>
              <MetricText>{resumo.financeiro.margem_pct}%</MetricText>
            </p>
            <p className="mt-1 text-nota text-tinta-fraca">${resumo.financeiro.margem.toFixed(2)}</p>
          </GlassCard>
        </div>
      )}

      {/* Abas */}
      <Segmented
        value={aba}
        onValueChange={(v) => setAba(v as typeof aba)}
        options={[
          { value: "resumo", label: "Resumo" },
          { value: "usuarios", label: "Usuários" },
          { value: "custos", label: "Custos" },
          { value: "kpis", label: "KPIs" },
        ]}
      />

      {/* Conteúdo por aba */}
      <div className="mt-6">
        {aba === "resumo" && resumo && (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Receita vs Custo */}
            <GlassCard nivel="cartao" radius="grupo" className="p-4">
              <p className="mb-4 text-corpo font-bold text-tinta">Receita vs Custo</p>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={[{ name: "Período", receita: resumo.financeiro.receita_total, custo: resumo.financeiro.custo_total }]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--borda))" />
                  <XAxis dataKey="name" stroke="hsl(var(--tinta-fraca))" />
                  <YAxis stroke="hsl(var(--tinta-fraca))" />
                  <Tooltip formatter={(v: any) => `$${Number(v).toFixed(2)}`} />
                  <Legend />
                  <Bar dataKey="receita" fill="hsl(var(--acerto))" />
                  <Bar dataKey="custo" fill="hsl(var(--erro))" />
                </BarChart>
              </ResponsiveContainer>
            </GlassCard>

            {/* Distribuição de usuários */}
            <GlassCard nivel="cartao" radius="grupo" className="p-4">
              <p className="mb-4 text-corpo font-bold text-tinta">Distribuição de Usuários</p>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={[
                      { name: "Ativos", value: resumo.usuarios.ativos },
                      { name: "Inativos", value: resumo.usuarios.inativos },
                    ]}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label
                    dataKey="value"
                  >
                    <Cell fill="hsl(var(--acerto))" />
                    <Cell fill="hsl(var(--erro))" />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </GlassCard>
          </div>
        )}

        {aba === "usuarios" && (
          <GlassCard nivel="cartao" radius="grupo" className="p-4">
            <p className="mb-4 text-corpo font-bold text-tinta">Custo por Usuário</p>
            {usuarios.length === 0 ? (
              <p className="text-nota text-tinta-fraca">Nenhum usuário encontrado</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-corpo">
                  <thead>
                    <tr className="border-b border-borda">
                      <th className="text-left py-2 px-3 text-nota text-tinta-fraca font-semibold">User ID</th>
                      <th className="text-right py-2 px-3 text-nota text-tinta-fraca font-semibold">Custo Total</th>
                      <th className="text-right py-2 px-3 text-nota text-tinta-fraca font-semibold">Tokens</th>
                      <th className="text-right py-2 px-3 text-nota text-tinta-fraca font-semibold">Operações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuarios.map((user) => (
                      <tr key={user.user_id} className="border-b border-borda/50 hover:bg-indigo/5">
                        <td className="py-3 px-3 text-nota text-tinta-fraca font-mono">{user.user_id.slice(0, 8)}...</td>
                        <td className="py-3 px-3 text-right text-tinta font-semibold">${user.custo_total.toFixed(2)}</td>
                        <td className="py-3 px-3 text-right text-tinta">{user.tokens_total.toLocaleString()}</td>
                        <td className="py-3 px-3 text-right text-tinta">{user.operacoes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        )}

        {aba === "custos" && (
          <GlassCard nivel="cartao" radius="grupo" className="p-4">
            <p className="text-corpo font-bold text-tinta">Custos por operação</p>
            <p className="mt-2 text-nota text-tinta-fraca">Em breve</p>
          </GlassCard>
        )}

        {aba === "kpis" && kpis && (
          <div className="grid gap-4 md:grid-cols-3">
            <GlassCard nivel="cartao" radius="grupo" className="p-4">
              <p className="text-nota text-tinta-fraca">Churn Rate</p>
              <p className="mt-2 text-[28px] font-bold text-tinta">
                <MetricText>{kpis.churn_rate_pct}%</MetricText>
              </p>
            </GlassCard>

            <GlassCard nivel="cartao" radius="grupo" className="p-4">
              <p className="text-nota text-tinta-fraca">LTV</p>
              <p className="mt-2 text-[28px] font-bold text-tinta">
                <MetricText>${kpis.ltv.toFixed(2)}</MetricText>
              </p>
            </GlassCard>

            <GlassCard nivel="cartao" radius="grupo" className="p-4">
              <p className="text-nota text-tinta-fraca">Uso Médio</p>
              <p className="mt-2 text-[28px] font-bold text-tinta">
                <MetricText>{kpis.uso_medio_tokens.toLocaleString()}</MetricText>
              </p>
              <p className="mt-1 text-nota text-tinta-fraca">tokens/usuário</p>
            </GlassCard>

            <GlassCard nivel="cartao" radius="grupo" className="p-4">
              <p className="text-nota text-tinta-fraca">Custo Mensal</p>
              <p className="mt-2 text-[28px] font-bold text-tinta">
                <MetricText>${kpis.custo_mensal.toFixed(2)}</MetricText>
              </p>
            </GlassCard>

            <GlassCard nivel="cartao" radius="grupo" className="p-4">
              <p className="text-nota text-tinta-fraca">Custo por Usuário</p>
              <p className="mt-2 text-[28px] font-bold text-tinta">
                <MetricText>${kpis.custo_medio_usuario.toFixed(2)}</MetricText>
              </p>
            </GlassCard>

            <GlassCard nivel="cartao" radius="grupo" className="p-4">
              <p className="text-nota text-tinta-fraca">Financiadores</p>
              <p className="mt-2 text-[28px] font-bold text-tinta">
                <MetricText>{kpis.financiadores}</MetricText>
              </p>
              <p className="mt-1 text-nota text-tinta-fraca">sem uso</p>
            </GlassCard>
          </div>
        )}
      </div>
    </div>
  );
}
