export default function ReforcoPage({ params }: { params: { id: string } }) {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Reforço</h2>
      <p className="text-muted-foreground">Professor: {params.id}</p>
    </div>
  );
}
