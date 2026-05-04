// Layout das rotas autenticadas — sidebar + área de conteúdo.
// Por enquanto é um shell simples; a sidebar real (com lista de professores)
// será adicionada quando tivermos auth + endpoints prontos.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 border-r bg-muted/40 p-4 md:block">
        <h1 className="text-xl font-bold">ProfessorIA</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          (sidebar — em construção)
        </p>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
