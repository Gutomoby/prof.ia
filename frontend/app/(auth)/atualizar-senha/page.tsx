"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, LockKeyhole } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { AuthShell, AuthCard } from "@/components/auth/AuthShell";
import { FieldGroup, Field, ToggleSenha } from "@/components/auth/AuthField";
import { Capsule } from "@/components/ui/capsule";
import { MetricText } from "@/components/ui/metric-text";
import { ProgressBar } from "@/components/ui/gauge";

/*
  Tela 51 (Nova senha). Destino do link de recuperação: o Supabase autentica o
  usuário ao abrir o link (sessão de recovery) — aqui só definimos a senha.

  A barra de força e o "Repetir" com o check verde vêm das telas 48 e 51. A
  força é medida no cliente, sem biblioteca: comprimento + variedade de
  classes de caractere. Não é entropia de verdade, é sinal de progresso.
*/
function forcaDaSenha(s: string): { pct: number; rotulo: string; tom: "erro" | "indigo" | "acerto" } {
  if (!s) return { pct: 0, rotulo: "", tom: "erro" };
  let classes = 0;
  if (/[a-z]/.test(s)) classes++;
  if (/[A-Z]/.test(s)) classes++;
  if (/[0-9]/.test(s)) classes++;
  if (/[^A-Za-z0-9]/.test(s)) classes++;

  const comprimento = Math.min(s.length / 12, 1);
  const pct = Math.round((comprimento * 0.6 + (classes / 4) * 0.4) * 100);

  if (s.length < 8) return { pct: Math.min(pct, 35), rotulo: "senha curta", tom: "erro" };
  if (pct < 65) return { pct, rotulo: "senha ok", tom: "indigo" };
  return { pct, rotulo: "senha boa", tom: "acerto" };
}

export default function AtualizarSenhaPage() {
  const router = useRouter();
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    // O processamento do link (code -> sessão) pode chegar depois do mount,
    // então além do getSession inicial escutamos a mudança de auth.
    supabase.auth.getSession().then(({ data }) => setHasSession(Boolean(data.session)));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(Boolean(session));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError("Não foi possível atualizar a senha. Peça um novo link e tente de novo.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  const forca = forcaDaSenha(password);
  const confere = confirm.length > 0 && confirm === password;

  if (hasSession === false) {
    return (
      <AuthShell fundo="recuperar">
        <AuthCard largura={440}>
          <div className="flex flex-1 flex-col justify-center gap-[18px] md:flex-none">
            <div>
              <span className="flex h-[52px] w-[52px] items-center justify-center rounded-[18px] bg-erro/12">
                <LockKeyhole className="h-6 w-6 text-erro" />
              </span>
              <h1 className="mt-3.5 text-titulo-estado">Link inválido ou expirado</h1>
              <p className="mt-1.5 text-corpo text-tinta-fraca">
                O link de redefinição só funciona uma vez e por tempo limitado.
              </p>
            </div>
            <Link
              href="/recuperar-senha"
              className="rounded-chip text-[16px] font-medium text-indigo focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte"
            >
              Pedir um novo link
            </Link>
          </div>
        </AuthCard>
      </AuthShell>
    );
  }

  return (
    <AuthShell fundo="recuperar" topRight="Sua sequência continua de onde parou">
      <AuthCard largura={440}>
        <div className="flex-none pt-[60px] md:pt-0">
          <span className="flex h-14 w-14 items-center justify-center rounded-alerta bg-indigo/10 md:h-[52px] md:w-[52px] md:rounded-[18px] md:bg-indigo/12">
            <LockKeyhole className="h-7 w-7 text-indigo md:h-6 md:w-6" />
          </span>
          <h1 className="mt-3.5 text-titulo-grande md:text-titulo-estado">Nova senha</h1>
          <p className="mt-1.5 text-corpo text-tinta-fraca">
            Escolha uma senha de pelo menos <MetricText tone="fraca">8</MetricText> caracteres.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="contents">
          <FieldGroup className="mt-[22px] md:mt-0">
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
            <Field
              label="Repetir"
              type={verSenha ? "text" : "password"}
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              trailing={confere ? <Check className="h-[18px] w-[18px] text-acerto" strokeWidth={3} /> : undefined}
            />
          </FieldGroup>

          {password && (
            <div className="mt-2.5 flex flex-none items-center gap-2.5 md:mt-0">
              <ProgressBar
                value={forca.pct}
                espessura="meta"
                tone={forca.tom === "acerto" ? "acerto" : "indigo"}
                aria-label="Força da senha"
              />
              <span
                className={
                  forca.tom === "acerto"
                    ? "text-[13.5px] font-semibold text-acerto"
                    : forca.tom === "erro"
                      ? "text-[13.5px] font-semibold text-erro"
                      : "text-[13.5px] font-semibold text-indigo"
                }
              >
                {forca.rotulo}
              </span>
            </div>
          )}

          {error && (
            <p className="mt-2 flex-none text-nota text-erro" role="alert">
              {error}
            </p>
          )}

          <Capsule
            type="submit"
            block
            loading={loading || hasSession === null}
            className="mt-[18px] md:mt-0"
          >
            Salvar nova senha
          </Capsule>
        </form>

        <div className="min-h-4 flex-1 md:hidden" />
      </AuthCard>
    </AuthShell>
  );
}
