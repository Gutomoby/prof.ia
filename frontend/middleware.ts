import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Protege /dashboard e /professor/*: sem sessão -> /login.
// Com sessão e tentando acessar /login -> /dashboard.
// Padrão oficial do @supabase/ssr para refrescar o cookie de sessão a cada request.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  // /perfil expõe e-mail e progresso, então entra na proteção junto com as
  // outras. (/biblioteca e /calendario também deveriam estar aqui — ficaram de
  // fora desde antes desta migração; ver nota na Fase E.)
  const isProtected =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/professor") ||
    pathname.startsWith("/licao") ||
    pathname.startsWith("/perfil");
  // Logado não tem o que fazer no login/criar conta. /recuperar-senha e
  // /atualizar-senha ficam FORA disso: o link de recovery autentica o usuário,
  // e redirecionar aqui impediria a troca de senha.
  const isGuestOnlyPage = pathname === "/login" || pathname === "/criar-conta";

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isGuestOnlyPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/materias",
    "/professor/:path*",
    "/licao/:path*",
    "/perfil/:path*",
    "/login",
    "/criar-conta",
  ],
};
