import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { QuizGuardProvider } from "@/components/layout/QuizGuardContext";

// Casca das rotas autenticadas: papel de parede + sidebar (desktop) ou barra de
// abas flutuante (celular). A lista de matérias/progresso da sidebar vem do
// cache compartilhado do cliente (lib/shared-data.ts, useProfessors/useProgress)
// — até 2026-09-07 era buscada aqui no servidor, sem cache, a cada navegação,
// bloqueando o primeiro byte da página pra buscar um dado que o cliente ia
// buscar de novo de qualquer jeito logo em seguida.
//
// O QuizGuardProvider vive aqui (não em professor/[id]/layout.tsx) porque
// precisa envolver a Sidebar também — ela navega para fora de um quiz em
// andamento tanto quanto o cabeçalho.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <QuizGuardProvider>
      {/* overflow-hidden no root: o halo do papel de parede não empurra a
          largura. min-h-screen em vez de h-screen para a página rolar normal. */}
      <div className="papel-de-parede altura-tela flex overflow-hidden text-tinta">
        <Sidebar />
        {/* No celular o padding de baixo abre espaço para a barra flutuante
            (64px + 12px de margem + área segura). No desktop, o ritmo do
            design: 34px em cima, 26px nos lados e embaixo. */}
        {/* A margem de 280px no desktop é o lugar da sidebar, que é `fixed`
            e saiu do fluxo para ficar sempre visível — ver Sidebar.tsx. */}
        <main className="min-w-0 flex-1 px-margem pb-[104px] pt-8 md:ml-[280px] md:px-[26px] md:pb-[26px] md:pt-[34px]">
          {children}
        </main>
      </div>
      <MobileNav />
    </QuizGuardProvider>
  );
}
