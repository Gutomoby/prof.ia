import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Brand } from "@/components/layout/Brand";

// Landing page (rota /). Server Component — sem JS no client além do que o
// Next manda automaticamente. Em produção fica leve e funciona sem auth.
export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background">
      {/* HERO */}
      <section className="container mx-auto flex flex-col items-center px-4 py-24 text-center md:py-32">
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-success" />
          Kango em construção · Fase A (rebranding) no ar
        </span>

        <h1 className="text-4xl md:text-6xl">
          <Brand />
        </h1>
        <p className="mt-3 text-lg font-medium text-primary md:text-xl">
          O seu companheiro de estudos
        </p>

        <p className="mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
          O Kango está sempre ao seu lado para transformar seus estudos em uma
          jornada leve, divertida e cheia de conquistas — com quizzes, trilhas
          e progresso gerados a partir do seu próprio material.
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link href="/login" className={buttonVariants("default", "lg", "px-8")}>
            Entrar no app
          </Link>
          <a
            href="https://github.com/Gutomoby/prof.ia"
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants("outline", "lg", "px-8")}
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
    <Card className="p-6">
      <div className="text-3xl">{icon}</div>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </Card>
  );
}
