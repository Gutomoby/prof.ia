/*
  Autenticação — porta de services/auth.py.

  O JWT já chega verificado: as Edge Functions do Supabase validam assinatura
  e expiração no gateway (verify_jwt, ligado por padrão em config.toml). O que
  falta é descobrir QUEM é, e é o que getUser() faz.

  Continua valendo a regra que motivou o arquivo original: nenhuma rota pode
  cair num usuário padrão quando não há token. Sem sessão, 401 — senão a
  segunda pessoa a criar conta enxerga o material da primeira.
*/

import { createClient } from "jsr:@supabase/supabase-js@2";
import { HttpError } from "./http.ts";
import { db } from "./db.ts";

export async function currentUserId(req: Request): Promise<string> {
  const header = req.headers.get("Authorization") ?? "";
  const [esquema, token] = header.split(" ");
  if (esquema?.toLowerCase() !== "bearer" || !token?.trim()) {
    throw new HttpError(401, "Autenticação necessária.");
  }

  const cliente = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: header } }, auth: { persistSession: false } },
  );

  const { data, error } = await cliente.auth.getUser();
  if (error || !data.user) throw new HttpError(401, "Sessão inválida. Entre de novo.");
  return data.user.id;
}

/*
  Admin vem de env (ADMIN_USER_IDS), não de claim no JWT.

  O papel teria de morar no user_metadata da conta, que é editável pelo próprio
  usuário: quem quisesse ver o painel de custos bastaria se promover.
*/
export async function requireAdmin(req: Request): Promise<string> {
  const userId = await currentUserId(req);
  const admins = new Set(
    (Deno.env.get("ADMIN_USER_IDS") ?? "").split(",").map((u) => u.trim()).filter(Boolean),
  );
  if (!admins.has(userId)) throw new HttpError(403, "Acesso de admin requerido");
  return userId;
}

/*
  Busca um professor GARANTINDO que ele pertence a `userId`.

  Responde 404, e não 403, de propósito: para quem não é dono, o professor não
  existe. Um 403 confirmaria que aquele id é de alguém.
*/
export async function getOwnedProfessor(
  professorId: string,
  userId: string,
  colunas = "*",
): Promise<Record<string, unknown>> {
  const { data, error } = await db()
    .from("professors")
    .select(colunas)
    .eq("id", professorId)
    .eq("user_id", userId)
    .limit(1);

  if (error) throw new HttpError(500, error.message);
  if (!data || data.length === 0) throw new HttpError(404, "Professor não encontrado");
  return data[0] as unknown as Record<string, unknown>;
}
