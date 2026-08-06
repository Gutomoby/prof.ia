"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, Flame, Settings, Share2, Target, Trophy } from "lucide-react";
import { api } from "@/lib/api";
import { createClient } from "@/lib/supabase";
import { PageHeader } from "@/components/layout/PageHeader";
import { GlassCard } from "@/components/ui/glass-card";
import { InsetList, InsetRow } from "@/components/ui/inset-list";
import { KangoPlaceholder } from "@/components/ui/kango-placeholder";
import { MetricText } from "@/components/ui/metric-text";
import { ProgressBar } from "@/components/ui/gauge";
import { Skeleton } from "@/components/ui/skeleton";
import { CompartilharProgresso } from "@/components/perfil/CompartilharProgresso";
import { CATALOGO } from "@/components/perfil/catalogo-conquistas";
import { PainelAuxiliar, PainelLinha, PainelPrincipal } from "@/components/layout/Painel";
import { capsuleVariants } from "@/components/ui/capsule";
import { cn } from "@/lib/utils";
import type { AchievementList, UserProgress } from "@/lib/types";

/*
  Tela 33 · Perfil.

  As conquistas entraram (tela 34) como uma linha com o contador, e não como
  a fileira de medalhas do desenho: a fileira mostra quatro discos coloridos
  sem dizer o que cada um é, e quem quer saber precisa entrar mesmo assim. A
  linha leva ao mesmo lugar e cabe ao lado das outras duas.

  "Compartilhar meu progresso" (tela 36) é desenhada no cliente com os
  números que esta tela já busca, sem depender de rota nova.

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
  const [nome, setNome] = useState<string | null>(null);
  const [desde, setDesde] = useState<string | null>(null);
  const [dominados, setDominados] = useState<number | null>(null);
  // Só para a tela 36: a matéria principal e o domínio médio entre elas.
  const [materia, setMateria] = useState<string | null>(null);
  const [dominioPct, setDominioPct] = useState<number | null>(null);
  const [compartilhando, setCompartilhando] = useState(false);
  const [conquistas, setConquistas] = useState<AchievementList | null>(null);

  useEffect(() => {
    api.getProgress().then(setProgress).catch(() => setProgress(null)).finally(() => setLoading(false));

    // O contador some se a chamada falhar; a linha continua levando à tela.
    api.listConquistas().then(setConquistas).catch(() => setConquistas(null));

    createClient()
      .auth.getUser()
      .then(({ data }) => {
        setEmail(data.user?.email ?? null);
        // full_name é o que a tela de cadastro pede; sem ele sobra o começo
        // do e-mail, que é o que o resto da tela já mostra.
        const completo = data.user?.user_metadata?.full_name;
        setNome(typeof completo === "string" && completo.trim() ? completo.trim() : null);
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
        setMateria(res.items[0]?.discipline ?? null);

        const somas = await Promise.allSettled(res.items.map((p) => api.getScoreSummary(p.id)));
        const ok = somas.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));

        setDominados(
          ok.reduce((soma, s) => soma + s.topics.filter((t) => t.status === "dominado").length, 0)
        );

        // Domínio do perfil é a média entre as matérias, cada uma pesando o
        // mesmo: quem estuda duas não tem a nota da maior diluindo a outra.
        setDominioPct(
          ok.length > 0
            ? ok.reduce((soma, s) => soma + s.overall_mastery_pct, 0) / ok.length
            : null
        );
      })
      .catch(() => setDominados(null));
  }, []);

  const faltam = progress ? progress.xp_do_nivel - progress.xp_no_nivel : 0;

  return (
    /*
      68 · Perfil no computador. O desenho junta Perfil e Configurações numa
      tela só; aqui elas continuam duas rotas, e o motivo é que a régua de
      seções do celular (Perfil → Configurações) some se as duas virarem uma
      no md e voltarem a ser duas embaixo de 768px. O que veio da 68: a ação
      de compartilhar ao lado do título e as conquistas na coluna auxiliar.
    */
    <div className="mx-auto w-full max-w-[560px] md:max-w-none">
      <PageHeader
        title="Perfil"
        action={
          progress ? (
            <button
              type="button"
              onClick={() => setCompartilhando(true)}
              className={capsuleVariants("secundaria", false, "hidden md:inline-flex")}
            >
              <Share2 className="h-[18px] w-[18px]" />
              Compartilhar progresso
            </button>
          ) : undefined
        }
      />

      <PainelLinha className="md:items-start">
      <PainelPrincipal className="gap-3">
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
            href="/perfil/conquistas"
            icon={<Trophy />}
            iconTone="acerto"
            title="Conquistas"
            value={conquistas ? `${conquistas.ganhas}/${conquistas.total}` : undefined}
            trailing={<ChevronRight className="h-[18px] w-[18px]" />}
          />
          <InsetRow
            icon={<Share2 />}
            iconTone="indigo"
            title="Compartilhar meu progresso"
            onClick={() => setCompartilhando(true)}
            disabled={!progress}
            trailing={<ChevronRight className="h-[18px] w-[18px]" />}
          />
          <InsetRow
            href="/perfil/configuracoes"
            icon={<Settings />}
            title="Configurações"
            trailing={<ChevronRight className="h-[18px] w-[18px]" />}
          />
        </InsetList>
      </PainelPrincipal>

      {/* Conquistas na coluna auxiliar (68): as três últimas, com a porta
          para a tela inteira. No celular elas continuam sendo a linha da
          lista acima — aqui a coluna existe e cabe mostrá-las. */}
      <PainelAuxiliar largura={330} className="mt-3 hidden md:mt-0 md:flex">
        {conquistas && conquistas.ganhas > 0 && (
          <div>
            <p className="mb-2 flex items-baseline justify-between gap-3 px-4 text-rotulo uppercase text-tinta-fraca">
              Conquistas
              <Link
                href="/perfil/conquistas"
                className="text-nota font-semibold normal-case tracking-normal text-indigo hover:underline"
              >
                Ver todas (<MetricText tone="indigo">{conquistas.ganhas}</MetricText> de{" "}
                <MetricText tone="indigo">{conquistas.total}</MetricText>)
              </Link>
            </p>
            <InsetList>
              {conquistas.items
                .filter((c) => c.ganha)
                .slice(0, 3)
                .map((c) => (
                  <InsetRow
                    key={c.id}
                    href="/perfil/conquistas"
                    icon={<Trophy />}
                    iconTone="acerto"
                    title={CATALOGO[c.id]?.nome ?? c.id}
                    subtitle={c.data ? c.data.split("-").reverse().slice(0, 2).join("/") : undefined}
                  />
                ))}
            </InsetList>
          </div>
        )}
      </PainelAuxiliar>
      </PainelLinha>

      {progress && (
        <CompartilharProgresso
          aberta={compartilhando}
          onFechar={() => setCompartilhando(false)}
          dados={{
            nome: nome ?? email?.split("@")[0] ?? "Aluno",
            materia,
            nivel: progress.level,
            sequencia: progress.current_streak,
            dominioPct,
            topicos: dominados,
          }}
        />
      )}
    </div>
  );
}
