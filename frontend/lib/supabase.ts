import { createBrowserClient } from "@supabase/ssr";

/*
  Cliente do Supabase para uso no NAVEGADOR (componentes "use client").
  Usa as duas variáveis públicas do .env.local:
    - NEXT_PUBLIC_SUPABASE_URL
    - NEXT_PUBLIC_SUPABASE_ANON_KEY

  Singleton de propósito: criar um GoTrueClient novo a cada chamada (como
  era antes) descarta o cache de sessão em memória que o próprio Supabase
  mantém, obrigando toda troca de tela a reler storage — cada api.* em
  lib/api.ts chama createClient() de novo por request. Uma instância só,
  reaproveitada, deixa a segunda chamada em diante praticamente instantânea.
*/
let _client: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  if (!_client) {
    _client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return _client;
}
