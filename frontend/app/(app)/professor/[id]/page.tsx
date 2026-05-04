// Dashboard de um professor específico — atalhos para chat, atividades e score.
// Placeholder; cards reais virão após os endpoints.
export default function ProfessorDashboardPage({ params }: { params: { id: string } }) {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Professor</h2>
      <p className="text-muted-foreground">ID: {params.id}</p>
      <p>Dashboard em construção.</p>
    </div>
  );
}
