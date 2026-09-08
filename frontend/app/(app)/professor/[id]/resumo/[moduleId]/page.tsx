"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Capsule } from "@/components/ui/capsule";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineAlert } from "@/components/ui/inline-alert";
import { KangoPlaceholder } from "@/components/ui/kango-placeholder";
import { MathText } from "@/components/ui/math-text";
import { Skeleton } from "@/components/ui/skeleton";
import type { ModuleSummary } from "@/lib/types";

/*
  Tela do resumo — "timbrado" do Kango: faixa cobalto no topo com o mascote
  numa bolha clara (mix-blend-multiply do Kango não fica bom direto em cima
  de um fundo escuro — o branco da imagem "some" contra claro, não contra
  escuro), título do capítulo, pontos-chave em lista e o corpo em prosa.
*/
export default function ResumoDetalhePage({ params }: { params: { id: string; moduleId: string } }) {
  const { id: professorId, moduleId } = params;
  const [summary, setSummary] = useState<ModuleSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    api
      .getModuleSummary(professorId, moduleId)
      .then(setSummary)
      .catch((err) => setErro(err instanceof ApiError ? err.message : "Não foi possível carregar o resumo."))
      .finally(() => setLoading(false));
  }, [professorId, moduleId]);

  async function gerar() {
    setErro(null);
    setGerando(true);
    try {
      setSummary(await api.generateModuleSummary(professorId, moduleId));
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível gerar o resumo.");
    } finally {
      setGerando(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-[640px] space-y-3">
        <Skeleton className="h-[92px] rounded-grupo" />
        <Skeleton className="h-[300px] rounded-grupo" />
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="mx-auto max-w-[520px]">
        {erro && <InlineAlert className="mb-4">{erro}</InlineAlert>}
        <EmptyState
          kango="lendo"
          title="Nenhum resumo ainda"
          description="O Kango monta um resumo desse capítulo a partir do material que você enviou."
          action={
            <Capsule loading={gerando} onClick={gerar}>
              <Sparkles className="h-[17px] w-[17px]" />
              Gerar resumo
            </Capsule>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[640px]">
      {erro && <InlineAlert className="mb-4">{erro}</InlineAlert>}

      <div className="overflow-hidden rounded-grupo shadow-hairline">
        <div className="flex items-center gap-3 bg-indigo px-5 py-4">
          <span className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-capsula bg-papel">
            <KangoPlaceholder px={44} estado="lendo" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-papel/70">Resumo · Kango</p>
            <p className="truncate text-titulo-cartao font-bold text-papel">{summary.content.titulo}</p>
          </div>
        </div>

        <div className="bg-papel p-5">
          <ul className="flex flex-col gap-2">
            {summary.content.pontos_principais.map((ponto, i) => (
              <li key={i} className="flex gap-2.5 text-corpo text-tinta">
                <span aria-hidden className="mt-[7px] h-1.5 w-1.5 flex-none rounded-capsula bg-indigo" />
                <MathText>{ponto}</MathText>
              </li>
            ))}
          </ul>

          <div className="mt-4 h-px bg-borda" />

          <MathText as="div" className="mt-4 whitespace-pre-line text-pretty text-corpo leading-[1.6] text-tinta">
            {summary.content.conteudo}
          </MathText>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Capsule variant="secundaria" loading={gerando} onClick={gerar}>
          <Sparkles className="h-[16px] w-[16px]" />
          Gerar de novo
        </Capsule>
      </div>
    </div>
  );
}
