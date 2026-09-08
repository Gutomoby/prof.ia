"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, FileText } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineAlert } from "@/components/ui/inline-alert";
import { InsetList, InsetRow } from "@/components/ui/inset-list";
import { Skeleton } from "@/components/ui/skeleton";
import type { Module } from "@/lib/types";

/*
  Lista de resumos — um por capítulo da trilha. Gerar/ver o conteúdo é na
  tela de detalhe (resumo/[moduleId]); aqui só decide qual capítulo abrir.
*/
export default function ResumoListaPage({ params }: { params: { id: string } }) {
  const professorId = params.id;
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listModules(professorId)
      .then((res) => setModules(res.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Não foi possível carregar os capítulos."))
      .finally(() => setLoading(false));
  }, [professorId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-[560px] space-y-2">
        <Skeleton className="h-[68px] rounded-grupo" />
        <Skeleton className="h-[68px] rounded-grupo" />
        <Skeleton className="h-[68px] rounded-grupo" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-[560px]">
        <InlineAlert>{error}</InlineAlert>
      </div>
    );
  }

  if (modules.length === 0) {
    return (
      <div className="mx-auto max-w-[520px]">
        <EmptyState
          kango="lendo"
          title="Nenhum capítulo ainda"
          description="Os resumos aparecem aqui assim que a trilha da matéria for montada."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[560px]">
      <InsetList label="Capítulos da trilha">
        {modules.map((m) => (
          <InsetRow
            key={m.id}
            href={`/professor/${professorId}/resumo/${m.id}`}
            icon={<FileText />}
            iconTone="indigo"
            title={m.name}
            subtitle={m.topics.length ? m.topics.join(", ") : undefined}
            trailing={<ChevronRight className="h-[18px] w-[18px]" />}
          />
        ))}
      </InsetList>
    </div>
  );
}
