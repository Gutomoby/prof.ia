"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TriangleAlert, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { AuthShell, AuthCard } from "@/components/auth/AuthShell";
import { FieldGroup, Field, ToggleSenha, Divisor } from "@/components/auth/AuthField";
import { SocialButtons } from "@/components/auth/SocialButtons";
import { Capsule, capsuleVariants } from "@/components/ui/capsule";
import { Kango } from "@/components/ui/kango";
import { cn } from "@/lib/utils";

/*
  Telas 01 (Entrar), 03 (senha errada) no celular e 46/47 no desktop.

  O erro não é um alerta genérico: ele troca o papel de parede para o degradê
  quente da 03, o Kango passa de "acenando" para "confuso", a linha da senha
  fica tonal em vermelho e a cápsula principal vira "Tentar de novo".
*/
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tentativas, setTentativas] = useState(0);

  const senhaErrada = error !== null && tentativas > 0;

  // /auth/callback manda pra cá com ?erro=... quando a troca do code do PKCE
  // falha (link de OAuth ou de recuperação de senha expirado/já usado). Lido
  // via window em vez de useSearchParams pra não exigir Suspense boundary
  // nesta página 100% client-side. Limpa a URL depois pra não reaparecer num
  // refresh.
  useEffect(() => {
    const erro = new URLSearchParams(window.location.search).get("erro");
    if (erro === "nao-foi-possivel-entrar") {
      setError("Não foi possível entrar. O link pode ter expirado — tente de novo.");
      window.history.replaceState({}, "", "/login");
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (signInError) {
      setTentativas((n) => n + 1);
      setError("E-mail ou senha inválidos");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <AuthShell
      fundo={senhaErrada ? "erro" : "entrar"}
      topRight={
        <Link href="/criar-conta" className={capsuleVariants("tonal", false, "h-9 px-4 text-[14px]")}>
          Criar conta grátis
        </Link>
      }
    >
      <AuthCard largura={460}>
        {/* Marca — herói no celular, ausente no desktop (vai no canto). Halo
            atrás do Kango dá presença de verdade em vez do ícone pequeno de
            antes; some no estado de erro pra não competir com o vermelho. */}
        <div className="flex flex-none flex-col items-center pt-24 md:hidden">
          <div
            className={cn(
              "flex h-[168px] w-[168px] items-center justify-center rounded-capsula",
              !senhaErrada && "bg-[radial-gradient(circle_at_50%_38%,hsl(226_57%_38%/.14),transparent_72%)]"
            )}
          >
            <Kango
              px={152}
              estado={senhaErrada ? "confuso" : "acenando"}
              tom={senhaErrada ? "neutro" : "indigo"}
              className={
                senhaErrada
                  ? "shadow-[inset_0_0_0_1px_rgba(255,255,255,.9),0_12px_30px_rgba(20,20,30,.12)]"
                  : "shadow-[inset_0_0_0_1px_rgba(255,255,255,.9),0_16px_34px_rgba(67,56,202,.16)]"
              }
            />
          </div>
          <p className="mt-[18px] text-[40px] font-bold leading-[44px] tracking-[0.37px] text-indigo">Kango</p>
          {!senhaErrada && (
            <p className="mt-2 max-w-[290px] text-center text-[16px] leading-[1.45] text-tinta-fraca">
              Seu professor particular, feito do material da sua matéria.
            </p>
          )}
        </div>

        {/* Cabeçalho do cartão — só no desktop. */}
        <div className="hidden md:block">
          <h1 className="text-titulo-estado">Entrar</h1>
          <p className="mt-1.5 text-corpo text-tinta-fraca">
            Sua sequência está esperando.
          </p>
        </div>

        {senhaErrada && (
          <div className="mt-[26px] flex flex-none items-start gap-2.5 rounded-alerta bg-erro/10 px-4 py-3.5 shadow-[inset_0_0_0_1px_hsl(0_72%_40%/.18)] md:mt-0">
            <TriangleAlert className="h-[18px] w-[18px] flex-none text-erro" />
            <div className="flex-1">
              <p className="text-corpo font-semibold text-erro">E-mail ou senha inválidos</p>
              <p className="mt-[3px] text-[14px] leading-[1.4] text-[hsl(220_13%_25%)]">
                Confira se o e-mail está certo. Se não lembra a senha, dá pra entrar por código.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="contents">
          <FieldGroup className={senhaErrada ? "mt-3.5 md:mt-0" : "mt-[30px] md:mt-0"}>
            <Field
              label="E-mail"
              type="email"
              required
              autoComplete="email"
              placeholder="voce@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Field
              label="Senha"
              type={verSenha ? "text" : "password"}
              required
              autoComplete="current-password"
              erro={senhaErrada}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              trailing={
                senhaErrada ? (
                  <XCircle className="h-[19px] w-[19px] text-erro" />
                ) : (
                  <ToggleSenha visivel={verSenha} onToggle={() => setVerSenha((v) => !v)} />
                )
              }
            />
          </FieldGroup>

          {/* No desktop (tela 46) o link fica numa linha à direita ANTES da
              cápsula; no celular (01) ele fica centrado depois dela. */}
          <div className="hidden justify-end md:flex">
            <Link
              href="/recuperar-senha"
              className="rounded-chip text-corpo font-medium text-indigo focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte"
            >
              Esqueci a senha
            </Link>
          </div>

          <Capsule type="submit" block loading={loading} className="mt-4 md:mt-0">
            {senhaErrada ? "Tentar de novo" : "Entrar"}
          </Capsule>
        </form>

        <Link
          href="/recuperar-senha"
          className="mt-3.5 flex-none rounded-chip text-center text-corpo font-medium text-indigo focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte md:hidden"
        >
          Esqueci minha senha
        </Link>

        <div className="my-6 flex-none md:my-0">
          <Divisor />
        </div>

        <SocialButtons onError={setError} />

        {error && !senhaErrada && (
          <p className="mt-3 flex-none text-nota text-erro" role="alert">
            {error}
          </p>
        )}

        <div className="min-h-4 flex-1 md:hidden" />
        <div className="flex flex-none flex-col gap-3 pb-[34px] md:hidden">
          {senhaErrada && (
            <p className="text-center text-[14px] text-tinta-fraca">
              Tentou {tentativas} {tentativas === 1 ? "vez" : "vezes"}. Depois de 5, o acesso trava por 15 minutos.
            </p>
          )}
          {/* Antes era um linkzinho de texto ("Primeira vez aqui? Criar
              conta") — fácil de não notar. Agora é uma cápsula de verdade,
              mesmo peso visual do resto das ações da tela. */}
          <Link href="/criar-conta" className={capsuleVariants("tonal", true)}>
            Criar conta
          </Link>
        </div>
      </AuthCard>
    </AuthShell>
  );
}
