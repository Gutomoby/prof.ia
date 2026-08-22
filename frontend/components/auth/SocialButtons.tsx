"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";

/*
  Entrar com Apple e com Google.

  Os logos são inline em vez de <img> de CDN (o protótipo usa jsDelivr): o app
  não faz request externo em runtime, e o CSP não precisa de exceção.

  O "G" é a versão COLORIDA do brand kit do Google, não o monocromático do
  simple-icons que o protótipo usa — a diretriz do Google não permite o
  monocromático no botão de login, e o README do handoff registra isso como
  requisito de produção.

  Empilhados de 52px no celular; lado a lado de 50px no desktop, onde o rótulo
  encurta para só a marca.
*/

function LogoApple({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );
}

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
  const [carregando, setCarregando] = useState<"apple" | "google" | null>(null);

  async function entrar(provider: "apple" | "google") {
    setCarregando(provider);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/dashboard` },
    });
    if (error) {
      setCarregando(null);
      // Provedor não habilitado no projeto Supabase cai aqui. Dizer a causa,
      // não "algo deu errado".
      onError(
        `Não foi possível continuar com ${provider === "apple" ? "Apple" : "Google"}. O provedor não está habilitado nesta conta.`
      );
    }
  }

  return (
    <div className="flex flex-col gap-3 md:flex-row">
      <button
        type="button"
        disabled={carregando !== null}
        onClick={() => entrar("apple")}
        className={cn(BASE, "bg-tinta text-papel hover:bg-[hsl(220_13%_16%)]")}
      >
        <LogoApple className="-mt-0.5 h-[19px] w-[19px] md:h-[18px] md:w-[18px]" />
        <span className="md:hidden">Continuar com Apple</span>
        <span className="hidden md:inline">Apple</span>
      </button>

      <button
        type="button"
        disabled={carregando !== null}
        onClick={() => entrar("google")}
        className={cn(
          BASE,
          "bg-white/92 text-tinta backdrop-blur-[20px] backdrop-saturate-[1.8]",
          "shadow-[inset_1.5px_1.5px_1px_rgba(255,255,255,.95),inset_0_0_0_1px_hsl(60_9%_88%),0_8px_22px_rgba(20,20,30,.07)]",
          "md:bg-white md:shadow-hairline md:backdrop-blur-none md:backdrop-saturate-100"
        )}
      >
        <LogoGoogle className="h-[18px] w-[18px] md:h-[17px] md:w-[17px]" />
        <span className="md:hidden">Continuar com Google</span>
        <span className="hidden md:inline">Google</span>
      </button>
    </div>
  );
}
