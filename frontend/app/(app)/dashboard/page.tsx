import Link from "next/link";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { ProfessorListItem } from "@/lib/types";

export default async function DashboardPage() {
  let professors: ProfessorListItem[] = [];
  let error: string | null = null;
  try {
    const res = await api.listProfessors();
    professors = res.items;
  } catch {
    error = "Não foi possível carregar seus professores. O backend está no ar?";
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Seus professores</h2>
        <Link
          href="/professor/novo"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          + Novo professor
        </Link>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!error && professors.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Você ainda não criou nenhum professor. Comece criando um assunto.
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {professors.map((p) => (
          <Card key={p.id}>
            <CardHeader>
              <CardTitle>{p.name}</CardTitle>
              <CardDescription>{p.discipline}</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Link href={`/professor/${p.id}/quiz`} className="text-sm text-primary underline-offset-2 hover:underline">
                Quiz
              </Link>
              <Link href={`/professor/${p.id}/configurar`} className="text-sm text-primary underline-offset-2 hover:underline">
                Material
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
