/*
  Cliente Supabase server-side (service_role).

  Diferente do backend Python, aqui NÃO existe o problema de thread que gerou
  o threading.local() em services/supabase_client.py: cada invocação da Edge
  Function é isolada e o fetch do Deno é seguro para uso concorrente. Um
  cliente por módulo basta.

  A service_role bypassa RLS — a separação entre usuários continua sendo
  responsabilidade das rotas, via currentUserId() e getOwnedProfessor().
*/

import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

let _admin: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (!_admin) {
    _admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return _admin;
}

/*
  Teto de linhas do PostgREST.

  O padrão é 1000 e ele não avisa quando corta: não há erro, não há flag, só
  faltam linhas. Isso já custou dois bugs em produção (623bc62 no digest da
  trilha, 72ef447 no painel financeiro). Toda leitura que pode passar de mil
  linhas — chunks, activity_results, token_logs — precisa vir por aqui.
*/
const PAGINA = 1000;

export async function selectAll<T = Record<string, unknown>>(
  // deno-lint-ignore no-explicit-any
  construirQuery: (from: number, to: number) => any,
): Promise<T[]> {
  const todas: T[] = [];
  for (let inicio = 0; ; inicio += PAGINA) {
    const { data, error } = await construirQuery(inicio, inicio + PAGINA - 1);
    if (error) throw new Error(error.message);
    const lote = (data ?? []) as T[];
    todas.push(...lote);
    if (lote.length < PAGINA) break;
  }
  return todas;
}
