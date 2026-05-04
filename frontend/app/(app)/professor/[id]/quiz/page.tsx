export default function QuizPage({ params }: { params: { id: string } }) {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Quiz</h2>
      <p className="text-muted-foreground">Professor: {params.id}</p>
    </div>
  );
}
