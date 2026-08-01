"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ScoreTrendPoint } from "@/lib/types";

function formatShortDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: ScoreTrendPoint }[] }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-sm shadow-sm">
      <p className="font-semibold metric text-foreground">{point.score_pct}%</p>
      <p className="text-xs text-muted-foreground">{new Date(point.data).toLocaleDateString("pt-BR")}</p>
    </div>
  );
}

export function ScoreTrendChart({ points }: { points: ScoreTrendPoint[] }) {
  const data = points.map((p) => ({ ...p, label: formatShortDate(p.data) }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
        <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="0" />
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
          minTickGap={24}
        />
        <YAxis
          domain={[0, 100]}
          ticks={[0, 50, 100]}
          axisLine={false}
          tickLine={false}
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
          width={36}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }} />
        <Line
          type="monotone"
          dataKey="score_pct"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={{ r: 4, fill: "hsl(var(--primary))", stroke: "hsl(var(--background))", strokeWidth: 2 }}
          activeDot={{ r: 6, fill: "hsl(var(--primary))", stroke: "hsl(var(--background))", strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
