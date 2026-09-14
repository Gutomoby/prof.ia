"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";

/*
  Entrar com Google.

  Apple ficou de fora por enquanto (decisão do usuário, 2026-09-13): exige
  Apple Developer Program + certificado/Services ID configurado no Supabase,
  complexidade maior que vale a pena isolar do resto do login social. Volta
  quando fizer sentido priorizar.

  O logo é inline em vez de <img> de CDN (o protótipo usa jsDelivr): o app
  não faz request externo em runtime, e o CSP não precisa de exceção.

  O "G" é a versão COLORIDA do brand kit do Google, não o monocromático do
  simple-icons que o protótipo usa — a diretriz do Google não permite o
  monocromático no botão de login, e o README do handoff registra isso como
  requisito de produção.
*/

function LogoGoogle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path
        fill="#4285F4"
        d="M23.06 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h6.19a5.3 5.3 0 0 1-2.3 3.48v2.89h3.72c2.17-2 3.45-4.95 3.45-8.38z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.11 0 5.72-1.03 7.62-2.79l-3.72-2.89c-1.03.69-2.35 1.1-3.9 1.1-3 0-5.55-2.03-6.46-4.75H1.69v2.98A11.5 11.5 0 0 0 12 24z"
      />
      <path fill="#FBBC05" d="M5.54 14.67a6.9 6.9 0 0 1 0-4.42V7.27H1.69a11.5 11.5 0 0 0 0 10.38l3.85-2.98z" />
      <path
        fill="#EA4335"
        d="M12 4.75c1.69 0 3.21.58 4.4 1.72l3.3-3.3C17.71 1.2 15.1 0 12 0 7.5 0 3.6 2.58 1.69 6.34l3.85 2.98C6.45 6.6 9 4.75 12 4.75z"
      />
    </svg>
  );
}

const BASE =
  "flex h-capsula-principal items-center justify-center gap-2.5 rounded-capsula text-linha font-semibold transition-all duration-180 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte disabled:pointer-events-none disabled:opacity-50 md:h-[50px] md:flex-1 md:text-[16px]";

export function SocialButtons({ onError }: { onError: (msg: string) => void }) {
  const [carregando, setCarregando] = useState(false);

  async function entrar() {
    setCarregando(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/dashboard` },
    });
    if (error) {
      setCarregando(false);
      // Provedor não habilitado no projeto Supabase cai aqui. Dizer a causa,
      // não "algo deu errado".
      onError("Não foi possível continuar com Google. O provedor não está habilitado nesta conta.");
    }
  }

  return (
    <button
      type="button"
      disabled={carregando}
      onClick={entrar}
      className={cn(
        BASE,
        "w-full bg-white/92 text-tinta backdrop-blur-[20px] backdrop-saturate-[1.8]",
        "shadow-[inset_1.5px_1.5px_1px_rgba(255,255,255,.95),inset_0_0_0_1px_hsl(60_9%_88%),0_8px_22px_rgba(20,20,30,.07)]",
        "md:bg-white md:shadow-hairline md:backdrop-blur-none md:backdrop-saturate-100"
      )}
    >
      <LogoGoogle className="h-[18px] w-[18px] md:h-[17px] md:w-[17px]" />
      Continuar com Google
    </button>
  );
}
