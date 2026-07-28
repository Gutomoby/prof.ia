import { createBrowserClient } from "@supabase/ssr";

/*
  Cliente do Supabase para uso no NAVEGADOR (componentes "use client").
  Usa as duas variáveis públicas do .env.local:
    - NEXT_PUBLIC_SUPABASE_URL
    - NEXT_PUBLIC_SUPABASE_ANON_KEY
*/
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
