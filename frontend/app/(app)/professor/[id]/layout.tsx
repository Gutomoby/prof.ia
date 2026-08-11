import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { tokenDaSessao } from "@/lib/supabase-server";
import { ProfessorHeader } from "@/components/layout/ProfessorHeader";
import { HeaderActionProvider } from "@/components/layout/HeaderActionContext";
import { InlineAlert } from "@/components/ui/inline-alert";

export default async function ProfessorLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  try {
    // Server Component: o token tem que ir explícito. Sem ele a chamada sai sem
    // Authorization e o backend responde 401 — que esta tela traduzia como
    // "o backend está no ar?", com o backend no ar.
    const professor = await api.getProfessor(params.id, { token: await tokenDaSessao() });
    return (
      // O provider precisa envolver o cabecalho E a pagina: e a pagina que
      // registra a acao do canto, e o cabecalho que a renderiza.
      <HeaderActionProvider>
        <ProfessorHeader professor={professor} />
        {children}
      </HeaderActionProvider>
    );
  } catch (err) {
    // Só afirma "não encontrado" quando o backend de fato disse 404 — qualquer
    // outra falha (rede, backend fora do ar) é um problema diferente e não
    // significa que o professor sumiu.
    const notFound = err instanceof ApiError && err.status === 404;
    return (
      <div className="space-y-4">
        <InlineAlert>
          {notFound ? "Professor não encontrado." : "Não foi possível carregar esse professor. O backend está no ar?"}
        </InlineAlert>
        <Link href="/dashboard" className="text-sm text-primary underline-offset-2 hover:underline">
          Voltar para o dashboard
        </Link>
      </div>
    );
  }
}
