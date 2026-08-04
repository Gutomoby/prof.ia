"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Settings } from "lucide-react";
import { api } from "@/lib/api";
import { createClient } from "@/lib/supabase";
import { PageHeader } from "@/components/layout/PageHeader";
import { GlassCard } from "@/components/ui/glass-card";
import { MetricText } from "@/components/ui/metric-text";
import { ProgressBar } from "@/components/ui/gauge";
import { Skeleton } from "@/components/ui/skeleton";
import { KangoPlaceholder } from "@/components/ui/kango-placeholder";
import { cn } from "@/lib/utils";
import type { UserProgress } from "@/lib/types";

/*
  Perfil. Nasce nesta fase porque a barra de abas tem quatro itens e o quarto é
  este — sem ele a casca não fecha.

  Só o que já tem dado real: identidade, nível/XP e sequência. Conquistas,
  "Compartilhar meu progresso", "Ajuda e contato" e "tópicos dominados" ficam
  para a Fase G, quando existir backend para eles. A copy é a das telas 33 e 35;
  nada foi reescrito, só omitido o que não tem como preencher.
*/

function Estatistica({ valor, rotulo }: { valor: number; rotulo: string }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-0.5">
      <MetricText weight="bold" className="text-[22px]">
        {valor}
      </MetricText>
      <span className="text-center text-nota text-tinta-fraca">{rotulo}</span>
    </div>
  );
}

export default function PerfilPage() {
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    api
      .getProgress()
      .then(setProgress)
      .catch(() => setProgress(null))
      .finally(() => setLoading(false));

    createClient()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null))
      .catch(() => setEmail(null));
  }, []);

  return (
    <div className="mx-auto max-w-[720px]">
      <PageHeader
        title="Perfil"
        action={
          <Link
            href="/perfil/configuracoes"
            aria-label="Configurações"
            className={cn(
              "flex h-toque w-toque items-center justify-center rounded-capsula bg-white",
              "text-indigo shadow-capsula-secundaria transition-all duration-180 ease-out hover:bg-papel",
              "focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte"
            )}
          >
            <Settings className="h-[19px] w-[19px]" />
          </Link>
        }
      />

      <div className="flex flex-col gap-4">
        <GlassCard className="flex items-center gap-4 p-4">
          <KangoPlaceholder px={64} estado="avatar" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-titulo-cartao">{email ?? "—"}</p>
          </div>
        </GlassCard>

        {loading && <Skeleton className="h-[104px] rounded-grupo" />}

        {!loading && progress && (
          <>
            <GlassCard className="p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-titulo-cartao">
                  Nível <MetricText weight="bold">{progress.level}</MetricText>
                </p>
                <p className="text-nota text-tinta-fraca">
                  <MetricText tone="fraca">{progress.total_xp.toLocaleString("pt-BR")}</MetricText> XP
                  no total
                </p>
              </div>
              <ProgressBar
                className="mt-3"
                value={(progress.xp_no_nivel / progress.xp_do_nivel) * 100}
                aria-label={`${progress.xp_no_nivel} de ${progress.xp_do_nivel} XP no nível ${progress.level}`}
              />
            </GlassCard>

            <GlassCard className="flex items-center gap-2 p-4">
              <Estatistica valor={progress.current_streak} rotulo="dias seguidos" />
              <span className="h-10 w-[0.5px] flex-none bg-borda" />
              <Estatistica valor={progress.longest_streak} rotulo="seu recorde" />
            </GlassCard>
          </>
        )}
      </div>
    </div>
  );
}
