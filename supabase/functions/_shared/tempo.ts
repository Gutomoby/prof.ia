/*
  "Dia de estudo" no fuso de quem estuda — porta de services/scoring.py.

  Os timestamps do banco são timestamptz em UTC. Contar o dia em UTC quebraria
  a sequência de quem estuda de noite no Brasil: às 22h em São Paulo já é o dia
  seguinte em UTC, e o streak morreria um dia antes da hora.
*/

const FUSO = Deno.env.get("APP_TIMEZONE") ?? "America/Sao_Paulo";

// en-CA formata como YYYY-MM-DD, que é exatamente o ISO de data que o banco
// e o resto do código esperam.
const FORMATADOR = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Data local (YYYY-MM-DD) de um timestamp do banco. */
export function paraDataLocal(valor: string | Date): string {
  const d = valor instanceof Date ? valor : new Date(valor);
  return FORMATADOR.format(d);
}

/** Hoje, no fuso do usuário (YYYY-MM-DD). */
export function hojeLocal(): string {
  return FORMATADOR.format(new Date());
}

/** Soma dias a uma data YYYY-MM-DD, sem passar por fuso nenhum. */
export function somarDias(dataIso: string, dias: number): string {
  const [a, m, d] = dataIso.split("-").map(Number);
  const base = new Date(Date.UTC(a, m - 1, d));
  base.setUTCDate(base.getUTCDate() + dias);
  return base.toISOString().slice(0, 10);
}
