/*
  Roteador mínimo por padrão de caminho.

  Existe para que a Edge Function sirva EXATAMENTE os mesmos caminhos que o
  FastAPI servia (/professores/{id}/modulos/gerar, /atividades/submeter, ...).
  Essa é a decisão central da migração: mantendo o contrato, o frontend troca
  só a URL base em lib/api.ts — nenhuma tela é reescrita, e dá para migrar
  rota a rota com o resto ainda de pé.
*/

import { HttpError, erro, json, corsHeaders } from "./http.ts";

export type Ctx = {
  req: Request;
  params: Record<string, string>;
  query: URLSearchParams;
  /** Corpo JSON já parseado. `{}` quando não houver corpo. */
  body: <T = Record<string, unknown>>() => Promise<T>;
};

export type Handler = (ctx: Ctx) => Promise<unknown>;

type Rota = { metodo: string; partes: string[]; handler: Handler };

export class Router {
  private rotas: Rota[] = [];

  add(metodo: string, caminho: string, handler: Handler): this {
    this.rotas.push({
      metodo,
      partes: caminho.split("/").filter(Boolean),
      handler,
    });
    return this;
  }

  get(c: string, h: Handler) { return this.add("GET", c, h); }
  post(c: string, h: Handler) { return this.add("POST", c, h); }
  patch(c: string, h: Handler) { return this.add("PATCH", c, h); }
  delete(c: string, h: Handler) { return this.add("DELETE", c, h); }

  private casar(metodo: string, partes: string[]): { rota: Rota; params: Record<string, string> } | null {
    for (const rota of this.rotas) {
      if (rota.metodo !== metodo || rota.partes.length !== partes.length) continue;
      const params: Record<string, string> = {};
      let bate = true;
      for (let i = 0; i < rota.partes.length; i++) {
        const esperado = rota.partes[i];
        if (esperado.startsWith(":")) params[esperado.slice(1)] = decodeURIComponent(partes[i]);
        else if (esperado !== partes[i]) { bate = false; break; }
      }
      if (bate) return { rota, params };
    }
    return null;
  }

  async handle(req: Request, prefixo: string): Promise<Response> {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders(req) });
    }

    const url = new URL(req.url);
    // O Supabase serve a função em /functions/v1/<nome>/<resto>. Só o <resto>
    // é o caminho da API — ele é que precisa bater com o contrato antigo.
    const partes = url.pathname.split("/").filter(Boolean);
    const iPrefixo = partes.indexOf(prefixo);
    const caminho = iPrefixo >= 0 ? partes.slice(iPrefixo + 1) : partes;

    const casado = this.casar(req.method, caminho);
    if (!casado) return erro(req, 404, `Rota não encontrada: ${req.method} /${caminho.join("/")}`);

    const ctx: Ctx = {
      req,
      params: casado.params,
      query: url.searchParams,
      body: async <T,>() => {
        const texto = await req.text();
        if (!texto) return {} as T;
        try {
          return JSON.parse(texto) as T;
        } catch {
          throw new HttpError(400, "Corpo da requisição não é JSON válido.");
        }
      },
    };

    try {
      return json(req, await casado.rota.handler(ctx));
    } catch (e) {
      if (e instanceof HttpError) return erro(req, e.status, e.message);
      // Erro não previsto: loga inteiro no painel do Supabase e devolve uma
      // mensagem que diz o próximo passo, no espírito do commit ee0f69d.
      console.error(`[${req.method} /${caminho.join("/")}]`, e);
      return erro(req, 500, "Algo quebrou do nosso lado. Tente de novo em instantes.");
    }
  }
}
