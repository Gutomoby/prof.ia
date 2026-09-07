import type { CapacitorConfig } from "@capacitor/cli";

/*
  Casca nativa que carrega o site em produção (server.url) em vez de um
  export estático — a autenticação depende do middleware/SSR do Next.js
  (cookies via @supabase/ssr, ver frontend/middleware.ts), que não
  sobrevive a um build estático empacotado dentro do app. `webDir` aponta
  pra um placeholder mínimo só porque o Capacitor exige a pasta; ela nunca
  é o que o usuário vê — assim que `server.url` está setado, o WebView
  navega direto pra lá.
*/
const config: CapacitorConfig = {
  appId: "br.com.kangoguru.app",
  appName: "Kango",
  webDir: "www",
  server: {
    url: "https://www.kangoguru.com.br",
    cleartext: false,
  },
  ios: {
    contentInset: "always",
  },
};

export default config;
