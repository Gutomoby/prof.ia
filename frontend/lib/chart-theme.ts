// Estilo do balão (tooltip) do Recharts nos tokens Kango.
//
// O Tooltip padrão do Recharts vem com fundo branco fixo e herda a cor do texto
// da página. No modo escuro o texto vira quase branco sobre o fundo branco e o
// balão fica ilegível. Aqui o fundo, a borda e o texto usam os mesmos tokens que
// o resto do app, que já trocam sozinhos entre claro e escuro (globals.css).
//
// Uso: <Tooltip {...tooltipTema} formatter={...} />
export const tooltipTema = {
  contentStyle: {
    background: "hsl(var(--superficie))",
    border: "0.5px solid hsl(var(--borda-forte))",
    borderRadius: 12,
    color: "hsl(var(--tinta))",
  },
  labelStyle: { color: "hsl(var(--tinta))", fontWeight: 700 },
  itemStyle: { color: "hsl(var(--tinta))" },
  cursor: { stroke: "hsl(var(--borda-forte))", strokeWidth: 1 },
} as const;
