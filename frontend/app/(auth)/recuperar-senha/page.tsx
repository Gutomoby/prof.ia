"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Inbox, KeyRound, MailCheck, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { AuthShell, AuthCard } from "@/components/auth/AuthShell";
import { FieldGroup, Field } from "@/components/auth/AuthField";
import { Capsule } from "@/components/ui/capsule";
import { InsetList, InsetRow } from "@/components/ui/inset-list";
import { MetricText } from "@/components/ui/metric-text";
import { KangoPlaceholder } from "@/components/ui/kango-placeholder";

/*
  Telas 04 (celular), 49 (Esqueci a senha) e 50 (Link enviado) no desktop.

  Duas coisas do design não têm backend e ficaram de fora, com nota no relatório:
  entrar por código de 6 dígitos e "Falar com a gente". O reenvio COM contagem
  existe de verdade — o contador é local, e é o que trava o botão.
*/
const ESPERA_REENVIO = 60;

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [segundos, setSegundos] = useState(0);

  useEffect(() => {
    if (segundos <= 0) return;
    const t = setTimeout(() => setSegundos((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [segundos]);

  async function enviar() {
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/atualizar-senha`,
    });
    setLoading(false);

    if (resetError) {
      setError("Não foi possível enviar o e-mail agora. Tente de novo em instantes.");
      return;
    }
    setSent(true);
    setSegundos(ESPERA_REENVIO);
  }

  const relogio = `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, "0")}`;

  if (sent) {
    return (
      <AuthShell fundo="recuperar">
        <AuthCard largura={440}>
          <div className="flex flex-1 flex-col justify-center gap-[18px] md:flex-none">
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

            <InsetList superficie="solido">
              <InsetRow icon={<Inbox />} title="Não chegou? Veja o spam" altura="campo" />
              <InsetRow
                icon={<RefreshCw />}
                title="Mandar de novo"
                altura="campo"
                onClick={segundos === 0 ? enviar : undefined}
                disabled={segundos > 0}
                value={
                  segundos > 0 ? (
                    <span className="text-corpo text-tinta-fraca">
                      em <MetricText tone="fraca">{relogio}</MetricText>
                    </span>
                  ) : undefined
                }
              />
            </InsetList>

            {error && (
              <p className="text-nota text-erro" role="alert">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={() => {
                setSent(false);
                setSegundos(0);
              }}
              className="rounded-chip text-center text-[16px] font-medium text-indigo focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte"
            >
              Trocar o e-mail
            </button>
          </div>
        </AuthCard>
      </AuthShell>
    );
  }

  return (
    <AuthShell fundo="recuperar">
      <AuthCard largura={440}>
        <div className="flex flex-none items-center justify-between pt-[60px] md:pt-0">
          <Link
            href="/login"
            className="flex items-center gap-1.5 rounded-chip text-linha font-medium text-indigo focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte md:text-[16px]"
          >
            <ChevronLeft className="h-[19px] w-[19px] md:h-[18px] md:w-[18px]" />
            <span className="md:hidden">Entrar</span>
            <span className="hidden md:inline">Voltar</span>
          </Link>
        </div>

        <div className="flex-none pt-[22px] md:pt-0">
          <span className="flex h-14 w-14 items-center justify-center rounded-alerta bg-indigo/10 md:h-[52px] md:w-[52px] md:rounded-[18px] md:bg-indigo/12">
            <KeyRound className="h-7 w-7 text-indigo md:h-6 md:w-6" />
          </span>
          <h1 className="mt-3.5 text-titulo-grande md:text-titulo-estado">
            <span className="md:hidden">Recuperar senha</span>
            <span className="hidden md:inline">Esqueci a senha</span>
          </h1>
          <p className="mt-2 text-corpo text-tinta-fraca">
            <span className="md:hidden">
              Digite o e-mail da sua conta. O Kango manda um link para você criar uma senha nova.
            </span>
            <span className="hidden md:inline">
              Diga o e-mail da conta e a gente manda um link para você criar outra.
            </span>
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            enviar();
          }}
          className="contents"
        >
          <FieldGroup className="mt-[22px] md:mt-0">
            <Field
              label="E-mail"
              type="email"
              required
              autoComplete="email"
              placeholder="voce@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </FieldGroup>

          <p className="mt-2 flex-none px-margem text-nota leading-[1.4] text-tinta-fraca md:mt-0 md:px-0 md:text-[13.5px] md:leading-[1.5]">
            <span className="md:hidden">O link vale por 1 hora e só funciona neste aparelho.</span>
            <span className="hidden md:inline">
              O link vale por 1 hora. Seu material e seu progresso não são afetados.
            </span>
          </p>

          {error && (
            <p className="mt-2 flex-none text-nota text-erro" role="alert">
              {error}
            </p>
          )}

          <Capsule type="submit" block loading={loading} className="mt-[18px] md:mt-0">
            <MailCheck className="h-[18px] w-[18px]" />
            <span className="md:hidden">Enviar o link</span>
            <span className="hidden md:inline">Mandar o link</span>
          </Capsule>
        </form>

        <div className="min-h-4 flex-1 md:hidden" />
        <div className="flex flex-none items-center gap-3 pb-[34px] md:hidden">
          <KangoPlaceholder px={44} />
          <p className="flex-1 text-nota leading-[1.4] text-tinta-fraca">
            &quot;Seu progresso não se perde: sequência, XP e material continuam na conta.&quot;
          </p>
        </div>
      </AuthCard>
    </AuthShell>
  );
}
