import { createBrowserClient } from "@supabase/ssr";

/*
  Cliente do Supabase para uso no NAVEGADOR (componentes "use client").
  Usa as duas variáveis públicas do .env.local:
    - NEXT_PUBLIC_SUPABASE_URL
    - NEXT_PUBLIC_SUPABASE_ANON_KEY

  Para uso server-side (Server Components, Route Handlers) crie outro cliente
  com createServerClient — fazemos isso quando formos implementar auth.
*/
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
