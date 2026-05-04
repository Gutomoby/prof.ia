// Upload de PDFs e textos do material — placeholder.
// Implementação completa virá no item 9 (upload + POST /documentos).
export default function ConfigurarPage({ params }: { params: { id: string } }) {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Configurar material</h2>
      <p className="text-muted-foreground">Professor: {params.id}</p>
    </div>
  );
}
