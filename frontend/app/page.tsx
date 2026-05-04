import Link from "next/link";

// Landing page (rota /). Server Component — sem JS no client além do que o
// Next manda automaticamente. Em produção fica leve e funciona sem auth.
export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background">
      {/* HERO */}
      <section className="container mx-auto flex flex-col items-center px-4 py-24 text-center md:py-32">
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          MVP em construção · Fases 1 e 2 prontas
        </span>

        <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
          🎓 ProfessorIA
        </h1>

        <p className="mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
          Crie um professor virtual de qualquer matéria — alimentado pelo seu
          próprio material. Tire dúvidas, gere quizzes, simulados e provas, e
          acompanhe sua evolução por tópico.
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/login"
            className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
          >
            Entrar no app
          </Link>
          <a
            href="https://github.com/Gutomoby/prof.ia"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center justify-center rounded-md border border-input bg-background px-8 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Ver código no GitHub
          </a>
        </div>
      </section>

      {/* FEATURES */}
      <section className="container mx-auto grid grid-cols-1 gap-6 px-4 pb-24 md:grid-cols-3">
        <FeatureCard
          icon="📚"
          title="Alimente com seu material"
          description="Suba PDFs ou cole textos. Tudo é processado localmente, fragmentado em chunks e indexado com pgvector."
        />
        <FeatureCard
          icon="💬"
          title="Converse com o professor"
          description="Chat com streaming via Claude Sonnet, respondendo sempre com base no seu próprio conteúdo (RAG)."
        />
        <FeatureCard
          icon="📊"
          title="Acompanhe sua evolução"
          description="4 tipos de atividades (Quiz, Simulado, Prova, Reforço) com score por tópico e recomendações personalizadas."
        />
      </section>

      {/* STACK */}
      <section className="container mx-auto px-4 pb-24 text-center">
        <h2 className="text-2xl font-bold">Construído com</h2>
        <p className="mt-2 text-muted-foreground">
          Stack moderna, custo de operação ~$3-7/mês para uso pessoal
        </p>
        <div className="mx-auto mt-8 flex max-w-2xl flex-wrap justify-center gap-2">
          {["Next.js 14", "Tailwind", "FastAPI", "Supabase", "pgvector", "Claude Sonnet 4 + Haiku 4.5", "sentence-transformers"].map(
            (tech) => (
              <span
                key={tech}
                className="rounded-md border bg-card px-3 py-1.5 text-sm text-card-foreground"
              >
                {tech}
              </span>
            ),
          )}
        </div>
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        Feito com ❤️ por{" "}
        <a
          href="https://github.com/Gutomoby"
          className="underline-offset-2 hover:underline"
        >
          @Gutomoby
        </a>
      </footer>
    </main>
  );
}

// Card simples reutilizado nas três features. Mantém estilo consistente.
function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
      <div className="text-3xl">{icon}</div>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
