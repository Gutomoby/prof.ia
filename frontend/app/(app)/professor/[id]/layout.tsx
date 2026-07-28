import Link from "next/link";
import { api } from "@/lib/api";
import { QuizGuardProvider } from "@/components/layout/QuizGuardContext";
import { ProfessorHeader } from "@/components/layout/ProfessorHeader";
import { InlineAlert } from "@/components/ui/inline-alert";

export default async function ProfessorLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  try {
    const professor = await api.getProfessor(params.id);
    return (
      <QuizGuardProvider>
        <ProfessorHeader professor={professor} />
        {children}
      </QuizGuardProvider>
    );
  } catch {
    return (
      <div className="space-y-4">
        <InlineAlert>Professor não encontrado.</InlineAlert>
        <Link href="/dashboard" className="text-sm text-primary underline-offset-2 hover:underline">
          Voltar para o dashboard
        </Link>
      </div>
    );
  }
}
