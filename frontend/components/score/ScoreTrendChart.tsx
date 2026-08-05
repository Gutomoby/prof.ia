"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { pctInteiro } from "@/lib/utils";
import type { ScoreTrendPoint } from "@/lib/types";

function formatShortDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

// Eixos e grade nos tokens Kango: a linha e indigo (mede desempenho), a grade
// e a borda a 0,5px do sistema, e todo numero entra em mono tabular — inclusive
// os rotulos dos eixos, que sao numero puro.
const MONO = "ui-monospace, 'SF Mono', Menlo, monospace";

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: ScoreTrendPoint }[] }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-chip bg-white px-3 py-2 shadow-vidro">
      <p className="text-corpo font-bold metric text-tinta">{pctInteiro(point.score_pct)}%</p>
      <p className="text-nota metric text-tinta-fraca">
        {new Date(point.data).toLocaleDateString("pt-BR")}
      </p>
    </div>
  );
}

export function ScoreTrendChart({ points }: { points: ScoreTrendPoint[] }) {
  const data = points.map((p) => ({ ...p, label: formatShortDate(p.data) }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
        <CartesianGrid vertical={false} stroke="hsl(var(--borda))" strokeDasharray="0" />
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tick={{ fill: "hsl(var(--tinta-fraca))", fontSize: 11, fontFamily: MONO }}
          minTickGap={24}
        />
        <YAxis
          domain={[0, 100]}
          ticks={[0, 50, 100]}
          axisLine={false}
          tickLine={false}
          tick={{ fill: "hsl(var(--tinta-fraca))", fontSize: 11, fontFamily: MONO }}
          width={32}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: "hsl(var(--borda-forte))", strokeWidth: 1 }} />
        <Line
          type="monotone"
          dataKey="score_pct"
          stroke="hsl(var(--indigo))"
          strokeWidth={2}
          dot={{ r: 4, fill: "hsl(var(--indigo))", stroke: "hsl(var(--papel))", strokeWidth: 2 }}
          activeDot={{ r: 6, fill: "hsl(var(--indigo))", stroke: "hsl(var(--papel))", strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
