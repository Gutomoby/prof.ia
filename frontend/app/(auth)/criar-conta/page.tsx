"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { AuthShell, AuthCard } from "@/components/auth/AuthShell";
import { FieldGroup, Field, ToggleSenha, Divisor } from "@/components/auth/AuthField";
import { SocialButtons } from "@/components/auth/SocialButtons";
import { Capsule } from "@/components/ui/capsule";
import { MetricText } from "@/components/ui/metric-text";

/*
  Telas 02 (celular) e 48 (desktop).

  O campo "Nome" existe no design e não existia no cadastro: vai em
  user_metadata.full_name, que é onde o Perfil vai buscar depois (hoje ele
  mostra o e-mail porque não havia nome).
*/
export default function CriarContaPage() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
        data: { full_name: nome.trim() || undefined },
      },
    });
    setLoading(false);

    if (signUpError) {
      setError(
        signUpError.message === "Signups not allowed for this instance"
          ? "A criação de novas contas está desativada no momento."
          : signUpError.message
      );
      return;
    }

    // Com confirmação de e-mail ligada o Supabase não devolve sessão —
    // o usuário precisa clicar no link antes de entrar.
    if (data.session) {
      router.push("/dashboard");
      router.refresh();
    } else {
      setAwaitingConfirm(true);
    }
  }

  if (awaitingConfirm) {
    return (
      <AuthShell fundo="criar">
        <AuthCard largura={440}>
          <div className="flex flex-1 flex-col justify-center md:flex-none">
            <div className="flex flex-col items-center text-center">
              <span className="flex h-[62px] w-[62px] items-center justify-center rounded-alerta bg-acerto/12">
                <MailCheck className="h-7 w-7 text-acerto" />
              </span>
              <h1 className="mt-4 text-[28px] font-bold leading-[34px] tracking-[0.3px]">Olhe o seu e-mail</h1>
              <p className="mt-2.5 text-corpo text-tinta-fraca">
                Mandei o link para <strong className="font-semibold text-tinta">{email}</strong>. Ele vale por 1
                hora.
              </p>
            </div>
            <Link
              href="/login"
              className="mt-[18px] rounded-chip text-center text-[16px] font-medium text-indigo focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte"
            >
              Voltar para entrar
            </Link>
          </div>
        </AuthCard>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      fundo="criar"
      topRight={
        <>
          Já tem conta?{" "}
          <Link href="/login" className="font-semibold text-indigo hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <AuthCard largura={460}>
        <Link
          href="/login"
          className="flex flex-none items-center gap-1.5 rounded-chip pt-[60px] text-linha font-medium text-indigo focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte md:pt-0 md:text-[16px]"
        >
          <ChevronLeft className="h-[19px] w-[19px] md:h-[18px] md:w-[18px]" />
          Voltar
        </Link>

        <div className="flex-none pt-[18px] md:pt-0">
          <h1 className="text-titulo-grande md:text-titulo-estado">Criar conta</h1>
          <p className="mt-1.5 text-corpo text-tinta-fraca">
            Seu material, sua sequência e seu progresso ficam salvos na conta.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="contents">
          <FieldGroup className="mt-5 md:mt-0">
            <Field
              label="Nome"
              type="text"
              autoComplete="name"
              placeholder="Como te chamar"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
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
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              trailing={<ToggleSenha visivel={verSenha} onToggle={() => setVerSenha((v) => !v)} />}
            />
          </FieldGroup>

          <p className="mt-2 flex-none px-margem text-nota text-tinta-fraca md:mt-0 md:px-0">
            Mínimo de <MetricText tone="fraca">8</MetricText> caracteres.
          </p>

          {error && (
            <p className="mt-2 flex-none text-nota text-erro" role="alert">
              {error}
            </p>
          )}

          <Capsule type="submit" block loading={loading} className="mt-[18px] md:mt-0">
            Criar conta
          </Capsule>
        </form>

        <div className="my-[22px] flex-none md:my-0">
          <Divisor />
        </div>

        <SocialButtons onError={setError} />

        <div className="min-h-3.5 flex-1 md:hidden" />
        <p className="flex-none pb-[34px] text-center text-[12.5px] leading-[1.45] text-tinta-fraca md:pb-0">
          Criando a conta você aceita os{" "}
          <span className="font-semibold text-indigo">termos</span> e a{" "}
          <span className="font-semibold text-indigo">privacidade</span>.
        </p>
      </AuthCard>
    </AuthShell>
  );
}
