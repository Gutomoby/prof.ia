/*
  Contrato HTTP — mantém o formato de erro que o FastAPI usava.

  O frontend (lib/api.ts, extractErrorMessage) lê `{"detail": "..."}` para
  mostrar mensagem na tela. Trocar isso quebraria toda a UX de erro que foi
  ajustada no commit ee0f69d, então o formato fica igual mesmo agora que o
  servidor é Deno.
*/

// Origens liberadas. Espelha main.py do backend antigo; EXTRA_CORS_ORIGINS
// continua valendo como secret da função, sem precisar de deploy pra mudar.
const ORIGENS_FIXAS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://profia-rose.vercel.app",
  "https://www.kangoguru.com",
  "https://kangoguru.com",
];

function origensPermitidas(): string[] {
  const extra = (Deno.env.get("EXTRA_CORS_ORIGINS") ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  return [...ORIGENS_FIXAS, ...extra];
}

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const permitida = origensPermitidas().includes(origin);
  return {
    // Sem origem conhecida devolve a primeira fixa: o navegador bloqueia, que
    // é o comportamento correto, e nunca ecoamos origem arbitrária de volta.
    "Access-Control-Allow-Origin": permitida ? origin : ORIGENS_FIXAS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

/** Erro com status HTTP — equivalente ao HTTPException do FastAPI. */
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

export function erro(req: Request, status: number, detail: string): Response {
  return json(req, { detail }, status);
}
