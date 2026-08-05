import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { QuizGuardProvider } from "@/components/layout/QuizGuardContext";
import { api } from "@/lib/api";
import type { ProfessorListItem } from "@/lib/types";

// Casca das rotas autenticadas: papel de parede + sidebar (desktop) ou barra de
// abas flutuante (celular). O fetch roda no servidor a cada request (sem cache),
// já que a lista de matérias muda com frequência.
//
// O QuizGuardProvider vive aqui (não em professor/[id]/layout.tsx) porque
// precisa envolver a Sidebar também — ela navega para fora de um quiz em
// andamento tanto quanto o cabeçalho.
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
      {/* overflow-hidden no root: o halo do papel de parede não empurra a
          largura. min-h-screen em vez de h-screen para a página rolar normal. */}
      <div className="papel-de-parede altura-tela flex overflow-hidden text-tinta">
        <Sidebar professors={professors} />
        {/* No celular o padding de baixo abre espaço para a barra flutuante
            (64px + 12px de margem + área segura). No desktop, o ritmo do
            design: 34px em cima, 26px nos lados e embaixo. */}
        <main className="min-w-0 flex-1 px-margem pb-[104px] pt-8 md:px-[26px] md:pb-[26px] md:pt-[34px]">
          {children}
        </main>
      </div>
      <MobileNav />
    </QuizGuardProvider>
  );
}
