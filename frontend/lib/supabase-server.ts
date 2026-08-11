import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/*
  Sessão do Supabase em Server Component.

  Server Component não tem navegador, então `lib/api.ts` não consegue ler o
  token sozinho (ele cai no cliente do browser, que lá não existe) e a chamada
  sai sem Authorization. Com o backend exigindo autenticação, isso vira 401 —
  e a tela mostra "o backend está no ar?" com o backend perfeitamente no ar.

  Foi o que aconteceu em professor/[id]/layout.tsx depois que a auth entrou:
  voltar para a matéria acusava backend fora do ar enquanto o resto do site,
  que é client-side e manda o token, funcionava normalmente.

  Quem renderiza no servidor e chama a API passa por aqui e repassa o token:

      const token = await tokenDaSessao();
      const professor = await api.getProfessor(id, { token });
*/
export async function tokenDaSessao(): Promise<string | undefined> {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        // Layout não pode gravar cookie — quem renova a sessão a cada request é
        // o middleware. Sem este no-op o @supabase/ssr tenta escrever e derruba
        // o render.
        setAll: () => {},
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token;
}
