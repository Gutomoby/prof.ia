"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { capsuleVariants } from "@/components/ui/capsule";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Skeleton } from "@/components/ui/skeleton";
import { DiagnosticoPronto } from "@/components/onboarding/DiagnosticoPronto";
import type { ActivityDetail, Professor, StudyPlan } from "@/lib/types";

/*
  Tela 11 · Diagnóstico pronto — a parte de buscar.

  Fecha o primeiro acesso: é o resultado do quiz de diagnóstico, lido tópico a
  tópico em vez de nota geral. Chega de /licao/[id]?diagnostico=1, que manda
  para cá em vez de mostrar o resultado padrão (tela 39) — a diferença é o
  propósito: a 39 mede a lição, esta diz por onde começar.

  Módulos e plano entram depois, cada um por conta: são o complemento da tela
  (os tópicos que o quiz não cobriu e o resumo do plano), e segurar a leitura
  do diagnóstico esperando por eles atrasaria o que importa.
*/
export default function DiagnosticoPage({ params }: { params: { id: string } }) {
  const professorId = params.id;
  const activityId = useSearchParams().get("a");

  const [professor, setProfessor] = useState<Professor | null>(null);
  const [atividade, setAtividade] = useState<ActivityDetail | null>(null);
  const [todosTopicos, setTodosTopicos] = useState<string[]>([]);
  const [plano, setPlano] = useState<StudyPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;

    async function carregar() {
      try {
        // A atividade vem por id quando a lição acabou de mandar para cá; sem
        // id (recarregar a página, por exemplo) usa-se a última tentativa.
        const id = activityId ?? (await api.listAtividades(professorId)).items[0]?.id ?? null;
        if (!id) throw new Error("sem tentativa");

        const [detalhe, prof] = await Promise.all([
          api.getAtividade(id),
          api.getProfessor(professorId),
        ]);
        if (!vivo) return;
        setAtividade(detalhe);
        setProfessor(prof);
      } catch {
        if (vivo) setErro("Não foi possível carregar o diagnóstico.");
      } finally {
        if (vivo) setLoading(false);
      }
    }

    carregar();

    api
      .listModules(professorId)
      .then(({ items }) => vivo && setTodosTopicos([...new Set(items.flatMap((m) => m.topics))]))
      .catch(() => {});
    api
      .getStudyPlan(professorId)
      .then((p) => vivo && setPlano(p))
      .catch(() => {});

    return () => {
      vivo = false;
    };
  }, [professorId, activityId]);

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-4 pt-1">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-[72px] w-64 rounded-cartao" />
        <Skeleton className="h-[180px] rounded-grupo" />
        <Skeleton className="h-[110px] rounded-grupo" />
      </div>
    );
  }

  if (erro || !atividade) {
    return (
      <div className="flex flex-1 flex-col justify-center">
        <InlineAlert>
          <div className="flex flex-col items-start gap-3">
            <span>{erro ?? "Não foi possível carregar o diagnóstico."}</span>
            <Link href={`/professor/${professorId}`} className={capsuleVariants("secundaria")}>
              Ir para a matéria
            </Link>
          </div>
        </InlineAlert>
      </div>
    );
  }

  return (
    <DiagnosticoPronto
      professorId={professorId}
      atividade={atividade}
      todosTopicos={todosTopicos}
      professor={professor}
      plano={plano}
    />
  );
}
