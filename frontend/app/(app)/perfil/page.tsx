"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Flame, Settings, Target, Trophy } from "lucide-react";
import { api } from "@/lib/api";
import { createClient } from "@/lib/supabase";
import { PageHeader } from "@/components/layout/PageHeader";
import { GlassCard } from "@/components/ui/glass-card";
import { InsetList, InsetRow } from "@/components/ui/inset-list";
import { KangoPlaceholder } from "@/components/ui/kango-placeholder";
import { MetricText } from "@/components/ui/metric-text";
import { ProgressBar } from "@/components/ui/gauge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { UserProgress } from "@/lib/types";

/*
  Tela 33 · Perfil.

  Duas coisas do desenho ficaram de fora, e o motivo é o mesmo: não existe
  backend.

  - Conquistas (as 9 medalhas e o "4 de 9"). Não há tabela, rota nem tipo —
    procurei no backend inteiro. Derivar no cliente seria inventar um sistema
    de conquistas, não mostrar um.
  - "Compartilhar meu progresso", que no desenho gera uma imagem.

  Ambas são a Fase G. Preferi a tela menor e verdadeira a caixas com número
  fixo.

  "Estudando desde" sai do created_at do usuário no Supabase, que é a data de
  cadastro de verdade.
*/

function Estatistica({
  icone,
  valor,
  rotulo,
}: {
  icone: React.ReactNode;
  valor: React.ReactNode;
  rotulo: string;
}) {
  return (
    <div className="flex-1 px-2 py-3.5 text-center">
      <span className="mx-auto flex h-[19px] w-[19px] items-center justify-center">{icone}</span>
      <MetricText as="p" weight="bold" className="mt-1 text-[22px] leading-none">
        {valor}
      </MetricText>
      <p className="mt-0.5 text-[11.5px] text-tinta-fraca">{rotulo}</p>
    </div>
  );
}

export default function PerfilPage() {
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [desde, setDesde] = useState<string | null>(null);
  const [dominados, setDominados] = useState<number | null>(null);

  useEffect(() => {
    api.getProgress().then(setProgress).catch(() => setProgress(null)).finally(() => setLoading(false));

    createClient()
      .auth.getUser()
      .then(({ data }) => {
        setEmail(data.user?.email ?? null);
        const criado = data.user?.created_at;
        if (criado) {
          // Maiuscula so na primeira letra. A classe `capitalize` do CSS
          // maiusculiza cada palavra e transforma "julho de 2026" em
          // "Julho De 2026".
          const mes = new Date(criado).toLocaleDateString("pt-BR", {
            month: "long",
            year: "numeric",
          });
          setDesde(mes.charAt(0).toUpperCase() + mes.slice(1));
        }
      })
      .catch(() => setEmail(null));

    // Tópicos dominados é por matéria em /score; o total do perfil é a soma.
    // Falha de uma matéria não derruba a conta — o número some, não mente.
    api
      .listProfessors()
      .then(async (res) => {
        const somas = await Promise.allSettled(res.items.map((p) => api.getScoreSummary(p.id)));
        const total = somas.reduce(
          (soma, r) =>
            r.status === "fulfilled"
              ? soma + r.value.topics.filter((t) => t.status === "dominado").length
              : soma,
          0
        );
        setDominados(total);
      })
      .catch(() => setDominados(null));
  }, []);

  const faltam = progress ? progress.xp_do_nivel - progress.xp_no_nivel : 0;

  return (
    <div className="mx-auto max-w-[560px]">
      <PageHeader title="Perfil" />

      <div className="flex flex-col gap-3">
        <GlassCard nivel="cartao" radius="grupo" className="flex items-center gap-4 p-4">
          <KangoPlaceholder px={64} estado="avatar" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-titulo-cartao text-tinta">{email?.split("@")[0] ?? "—"}</p>
            <p className="truncate text-corpo text-tinta-fraca">{email ?? "—"}</p>
            {desde && (
              <p className="mt-0.5 text-corpo text-tinta-fraca">
                Estudando desde {desde}
              </p>
            )}
          </div>
        </GlassCard>

        {loading && <Skeleton className="h-[104px] rounded-grupo" />}

        {!loading && progress && (
          <>
            <GlassCard nivel="cartao" radius="grupo" className="p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-titulo-cartao text-tinta">
                  Nível <MetricText weight="bold">{progress.level}</MetricText>
                </p>
                <p className="text-nota text-tinta-fraca">
                  <MetricText tone="fraca">{progress.total_xp.toLocaleString("pt-BR")}</MetricText>{" "}
                  XP no total
                </p>
              </div>
              <ProgressBar
                className="mt-3"
                value={(progress.xp_no_nivel / progress.xp_do_nivel) * 100}
                aria-label={`${progress.xp_no_nivel} de ${progress.xp_do_nivel} XP no nível ${progress.level}`}
              />
              <p className="mt-2 text-nota text-tinta-fraca">
                Faltam <MetricText tone="fraca" weight="bold">{faltam}</MetricText> XP para o nível{" "}
                <MetricText tone="fraca">{progress.level + 1}</MetricText>.
              </p>
            </GlassCard>

            <GlassCard nivel="cartao" radius="cartao" className="flex items-stretch">
              <Estatistica
                icone={
                  <Flame
                    className={cn(
                      "h-[19px] w-[19px]",
                      progress.current_streak > 0 ? "text-acerto" : "text-tinta-fraca"
                    )}
                  />
                }
                valor={progress.current_streak}
                rotulo={progress.current_streak === 1 ? "dia seguido" : "dias seguidos"}
              />
              <span aria-hidden className="w-[0.5px] flex-none bg-borda" />
              <Estatistica
                icone={<Trophy className="h-[19px] w-[19px] text-indigo" />}
                valor={progress.longest_streak}
                rotulo="seu recorde"
              />
              <span aria-hidden className="w-[0.5px] flex-none bg-borda" />
              <Estatistica
                icone={<Target className="h-[19px] w-[19px] text-indigo" />}
                valor={dominados ?? "—"}
                rotulo={dominados === 1 ? "tópico dominado" : "tópicos dominados"}
              />
            </GlassCard>
          </>
        )}

        {/* Uma porta so para Configuracoes. O handoff poe a engrenagem no canto
            do titulo, mas com a linha embaixo ficavam duas entradas para o
            mesmo lugar — a linha ganha por ser a que se le. */}
        <InsetList className="mt-2">
          <InsetRow
            href="/perfil/configuracoes"
            icon={<Settings />}
            title="Configurações"
            trailing={<ChevronRight className="h-[18px] w-[18px]" />}
          />
        </InsetList>
      </div>
    </div>
  );
}
