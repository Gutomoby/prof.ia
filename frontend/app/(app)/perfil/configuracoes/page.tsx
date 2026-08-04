"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { PageHeader } from "@/components/layout/PageHeader";
import { InsetList, InsetRow } from "@/components/ui/inset-list";
import { Capsule } from "@/components/ui/capsule";
import { useQuizGuard } from "@/components/layout/QuizGuardContext";

/*
  Configurações. Nesta fase carrega só "Sair da conta" — que precisava de casa,
  porque saiu da sidebar e da gaveta do celular junto com a casca antiga.

  As seções "Estudo" (lembrete diário, horário, meta), "Aparência" (sistema /
  claro / escuro) e "Conta e dados" (trocar senha, baixar progresso, apagar
  conta) são da tela 35 e entram na Fase G: nenhuma tem backend hoje. Preferi
  não desenhar controle que não faz nada.
*/
export default function ConfiguracoesPage() {
  const router = useRouter();
  const { unsaved } = useQuizGuard();
  const [email, setEmail] = useState<string | null>(null);
  const [saindo, setSaindo] = useState(false);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null))
      .catch(() => setEmail(null));
  }, []);

  async function handleLogout() {
    if (unsaved && !window.confirm("Sair sem enviar? Suas respostas serão perdidas.")) return;
    setSaindo(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-[520px]">
      <PageHeader title="Configurações" backHref="/perfil" backLabel="Perfil" />

      <div className="flex flex-col gap-[22px]">
        <InsetList label="Conta">
          <InsetRow title="E-mail" value={<span className="text-corpo text-tinta-fraca">{email ?? "—"}</span>} />
        </InsetList>

        <Capsule variant="tonal" block onClick={handleLogout} loading={saindo}>
          Sair da conta
        </Capsule>
      </div>
    </div>
  );
}
