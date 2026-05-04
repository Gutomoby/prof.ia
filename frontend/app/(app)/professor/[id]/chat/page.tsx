// Chat com o professor (RAG + streaming) — placeholder.
// Implementação completa no item 10.
export default function ChatPage({ params }: { params: { id: string } }) {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Chat</h2>
      <p className="text-muted-foreground">Professor: {params.id}</p>
    </div>
  );
}
