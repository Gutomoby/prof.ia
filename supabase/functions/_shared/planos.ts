/*
  Fonte única dos planos pagos — reaproveitado por api/routes/assinaturas.ts
  e api/routes/financeiro.ts para não duplicar os mesmos 3 preços em dois
  arquivos (o financeiro.ts antigo tinha sua própria cópia hardcoded).
*/

export type PlanId = "basico" | "pro" | "kango";

export const PLAN_IDS: PlanId[] = ["basico", "pro", "kango"];

export const PLAN_PRICES: Record<PlanId, number> = {
  basico: 39.9,
  pro: 89.9,
  kango: 129.9,
};

export function isPlanId(valor: unknown): valor is PlanId {
  return typeof valor === "string" && (PLAN_IDS as string[]).includes(valor);
}
