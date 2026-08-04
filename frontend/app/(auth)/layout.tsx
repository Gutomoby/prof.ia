import { BookOpen, Flame, Target } from "lucide-react";

/*
  Shell compartilhado das telas de auth (login, criar conta, recuperar e
  redefinir senha): painel temático à esquerda no desktop, formulário à
  direita. O painel commita no azul-marinho do Kango nos dois temas — é a
  única área do app single-theme de propósito (é a "capa" do produto).
*/
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen">
      <aside
        className="relative hidden w-1/2 flex-col justify-between overflow-hidden p-10 text-slate-100 lg:flex"
        style={{ backgroundColor: "#0d1326" }}
      >
        {/* brilho decorativo — sutil, só pra tirar o chapado */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full opacity-30"
          style={{ background: "radial-gradient(circle, #2563eb 0%, transparent 70%)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #f59e0b 0%, transparent 70%)" }}
        />

        <p className="text-3xl font-bold uppercase tracking-tight">
          <span style={{ color: "#7ea6ff" }}>K</span>ango
        </p>

        <div className="relative space-y-8">
          <div>
            <h1 className="text-3xl font-bold leading-tight">
              O seu companheiro
              <br />
              de estudos
            </h1>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-300">
              Transforme o seu próprio material em uma jornada leve, divertida e
              cheia de conquistas.
            </p>
          </div>

          <ul className="space-y-4 text-sm text-slate-200">
            <li className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: "#1c2a52" }}>
                <BookOpen className="h-4 w-4" style={{ color: "#7ea6ff" }} />
              </span>
              Quizzes gerados do seu material, por módulo e dificuldade
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: "#1c2a52" }}>
                <Flame className="h-4 w-4" style={{ color: "#f59e0b" }} />
              </span>
              Sequência diária pra manter o ritmo
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: "#1c2a52" }}>
                <Target className="h-4 w-4" style={{ color: "#f59e0b" }} />
              </span>
              Meta de XP, níveis e trilha de domínio por matéria
            </li>
          </ul>
        </div>

        <p className="relative text-xs text-slate-400">Kango — estude de verdade.</p>
      </aside>

      <div className="flex flex-1 items-center justify-center p-6 sm:p-8">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </main>
  );
}
