"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, LogOut, Target } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { createClient } from "@/lib/supabase";
import { PageHeader } from "@/components/layout/PageHeader";
import { Capsule } from "@/components/ui/capsule";
import { GlassCard } from "@/components/ui/glass-card";
import { InlineAlert } from "@/components/ui/inline-alert";
import { InsetList, InsetRow } from "@/components/ui/inset-list";
import { KangoPlaceholder } from "@/components/ui/kango-placeholder";
import { MetricText } from "@/components/ui/metric-text";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuizGuard } from "@/components/layout/QuizGuardContext";
import type { UserProgress } from "@/lib/types";

/*
  Tela 35 · Configurações.

  Do desenho, só a meta diária e a conta têm backend. O que ficou de fora, e
  por quê:

  - Lembrete diário e horário (20:00): reminderEnabled/reminderTime não existem
    em lugar nenhum — nem coluna, nem rota.
  - Aparência (Sistema / Claro / Escuro): além de não haver onde guardar, o
    modo escuro não foi DESENHADO. As 81 telas são claras e os tokens Kango não
    respondem a prefers-color-scheme (ver "Pendências de design" no plano). Um
    seletor de tema aqui prometeria uma tela que não existe.
  - Baixar progresso em CSV e apagar a conta: sem rota.

  Controle que não faz nada é pior que controle ausente: o primeiro mente.

  Sobre a meta: o handoff mostra "2 lições", mas o que o backend deixa ajustar
  é a meta em XP (daily_goal_xp / PATCH /progresso/meta). A meta em lições é
  constante hoje (META_DIARIA_LICOES). Então o controle edita o que existe, e a
  tela diz qual dos dois números ele mexe.
*/

const OPCOES_XP = [30, 50, 80, 120];

export default function ConfiguracoesPage() {
  const router = useRouter();
  const { unsaved } = useQuizGuard();

  const [email, setEmail] = useState<string | null>(null);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvandoMeta, setSalvandoMeta] = useState<number | null>(null);
  const [erroMeta, setErroMeta] = useState<string | null>(null);

  const [enviandoReset, setEnviandoReset] = useState(false);
  const [avisoReset, setAvisoReset] = useState<string | null>(null);
  const [saindo, setSaindo] = useState(false);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null))
      .catch(() => setEmail(null));

    api.getProgress().then(setProgress).catch(() => setProgress(null)).finally(() => setLoading(false));
  }, []);

  async function mudarMeta(xp: number) {
    if (progress?.daily_goal_xp === xp) return;
    setErroMeta(null);
    setSalvandoMeta(xp);
    try {
      setProgress(await api.updateDailyGoal(xp));
    } catch (err) {
      setErroMeta(err instanceof ApiError ? err.message : "Não foi possível salvar a meta.");
    } finally {
      setSalvandoMeta(null);
    }
  }

  async function trocarSenha() {
    if (!email) return;
    setAvisoReset(null);
    setEnviandoReset(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/atualizar-senha`,
      });
      setAvisoReset(
        error
          ? "Não foi possível enviar o link agora."
          : "Link enviado. Confira a caixa de entrada — ele vale por 1 hora."
      );
    } finally {
      setEnviandoReset(false);
    }
  }

  async function sair() {
    if (unsaved && !window.confirm("Sair sem enviar? Suas respostas serão perdidas.")) return;
    setSaindo(true);
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-[560px]">
      <PageHeader title="Configurações" backHref="/perfil" backLabel="Perfil" />

      <div className="flex flex-col gap-[22px]">
        <GlassCard nivel="cartao" radius="grupo" className="flex items-center gap-3 p-4">
          <KangoPlaceholder px={44} estado="avatar" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-linha font-semibold text-tinta">
              {email?.split("@")[0] ?? "—"}
            </p>
            <p className="truncate text-nota text-tinta-fraca">{email ?? "—"}</p>
          </div>
        </GlassCard>

        <div>
          <p className="mb-2 px-rotulo-secao text-rotulo uppercase text-tinta-fraca">Estudo</p>
          {loading ? (
            <Skeleton className="h-[104px] rounded-grupo" />
          ) : (
            <InsetList footnote="A meta do dia na home é contada em lições; esta, em XP, soma o esforço inteiro — inclusive material que você sobe.">
              <InsetRow
                icon={<Target />}
                iconTone="indigo"
                altura="dupla"
                title="Meta diária de XP"
                subtitle={
                  progress ? (
                    <>
                      Hoje: <MetricText tone="fraca">{progress.xp_hoje}</MetricText> de{" "}
                      <MetricText tone="fraca">{progress.daily_goal_xp}</MetricText> XP
                    </>
                  ) : (
                    "—"
                  )
                }
              />
              <div className="flex flex-wrap gap-2 px-4 pb-3.5 pt-1">
                {OPCOES_XP.map((xp) => {
                  const ativa = progress?.daily_goal_xp === xp;
                  return (
                    <button
                      key={xp}
                      type="button"
                      onClick={() => mudarMeta(xp)}
                      disabled={salvandoMeta !== null}
                      aria-pressed={ativa}
                      className={
                        "inline-flex items-center gap-1.5 rounded-capsula px-[13px] py-2 text-nota transition-colors duration-140 ease-out disabled:opacity-60 focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte " +
                        (ativa
                          ? "bg-indigo font-semibold text-papel"
                          : "bg-cinza-tonal font-medium text-tinta-fraca hover:bg-borda")
                      }
                    >
                      {salvandoMeta === xp && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      <MetricText weight={ativa ? "bold" : "normal"}>{xp}</MetricText> XP
                    </button>
                  );
                })}
              </div>
            </InsetList>
          )}
          {erroMeta && (
            <div className="mt-2">
              <InlineAlert>{erroMeta}</InlineAlert>
            </div>
          )}
        </div>

        <div>
          <p className="mb-2 px-rotulo-secao text-rotulo uppercase text-tinta-fraca">
            Conta e dados
          </p>
          <InsetList>
            <InsetRow
              icon={enviandoReset ? <Loader2 className="animate-spin" /> : <KeyRound />}
              altura="dupla"
              title="Trocar a senha"
              subtitle="Enviamos um link para o seu e-mail"
              onClick={trocarSenha}
              disabled={enviandoReset || !email}
            />
            <InsetRow
              icon={<LogOut />}
              iconTone="erro"
              title={<span className="text-erro">Sair da conta</span>}
              onClick={sair}
              disabled={saindo}
            />
          </InsetList>
          {avisoReset && (
            <div className="mt-2">
              <InlineAlert>{avisoReset}</InlineAlert>
            </div>
          )}
        </div>

        {saindo && (
          <Capsule variant="texto" block disabled>
            Saindo...
          </Capsule>
        )}
      </div>
    </div>
  );
}
