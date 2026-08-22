import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/*
  Troca o `code` do PKCE por sessão e grava o cookie. Serve duas origens:
  login social (SocialButtons.tsx, signInWithOAuth) e recuperação de senha
  (recuperar-senha/page.tsx, resetPasswordForEmail) — as duas mandam o
  usuário de volta com o mesmo tipo de `code` na URL, e o exchange é
  idêntico independente do que iniciou o fluxo.

  Sem isto, o `code` fica na URL sem nada chamar exchangeCodeForSession — o
  middleware não vê usuário logado e manda de volta pro /login (ou, no caso
  de atualizar-senha, a tela mostra "link inválido" mesmo num link fresco).
*/
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/login?erro=nao-foi-possivel-entrar`);
}
