import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { QuizGuardProvider } from "@/components/layout/QuizGuardContext";
import { api } from "@/lib/api";
import type { ProfessorListItem } from "@/lib/types";

// Layout das rotas autenticadas — sidebar (lista de professores + logout) +
// área de conteúdo. O fetch roda no servidor a cada request (sem cache),
// já que a lista de professores muda com frequência.
//
// O QuizGuardProvider vive aqui (não em professor/[id]/layout.tsx) porque
// precisa envolver a Sidebar também — ela navega para fora de um quiz em
// andamento (trocar de professor, "Sair") tanto quanto o header.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let professors: ProfessorListItem[] = [];
  try {
    const res = await api.listProfessors();
    professors = res.items;
  } catch {
    // Backend fora do ar: sidebar mostra lista vazia em vez de quebrar a página.
  }

  return (
    <QuizGuardProvider>
      <div className="flex min-h-screen">
        <Sidebar professors={professors} />
        {/* pb generoso no mobile para o conteúdo não ficar sob a barra fixa */}
        <main className="min-w-0 flex-1 p-4 pb-24 md:p-6 md:pb-6">{children}</main>
      </div>
      <MobileNav professors={professors} />
    </QuizGuardProvider>
  );
}
