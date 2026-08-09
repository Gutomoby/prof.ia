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
        <h1 className="text-4xl md:text-6xl">
          <Brand />
        </h1>
        <p className="mt-3 text-lg font-medium text-primary md:text-xl">
          Estude de forma inteligente
        </p>

        <p className="mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
          Transforme seu material de estudo em uma trilha de aprendizado personalizada.
          Quizzes, progressão real e sempre pronto quando você precisa estudar.
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link href="/login" className={buttonVariants("default", "lg", "px-8")}>
            Entrar
          </Link>
          <Link href="/criar-conta" className={buttonVariants("outline", "lg", "px-8")}>
            Criar conta
          </Link>
        </div>
      </section>

      {/* FEATURES */}
      <section className="container mx-auto grid grid-cols-1 gap-6 px-4 pb-24 md:grid-cols-3">
        <FeatureCard
          icon="🎯"
          title="Trilha de aprendizado"
          description="Sua jornada de estudos organizada em módulos. Sempre claro onde você está e o que vem depois."
        />
        <FeatureCard
          icon="✍️"
          title="Quizzes inteligentes"
          description="Pratique com quizzes baseados no seu próprio material. Feedback imediato e progresso visível."
        />
        <FeatureCard
          icon="📈"
          title="Seu progresso em tempo real"
          description="Sequência de estudos, domínio por tópico, XP e nível. Sinta o progresso acontecendo."
        />
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        Kango — o seu companheiro de estudos.
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
