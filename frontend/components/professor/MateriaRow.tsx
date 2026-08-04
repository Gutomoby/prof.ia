import Link from "next/link";
import { ChevronRight, Flame } from "lucide-react";
import { MetricText } from "@/components/ui/metric-text";
import { Pill, tonePilulaDaNota } from "@/components/ui/pill";
import { professorColor } from "@/lib/professor-color";
import { cn, pctInteiro } from "@/lib/utils";

/*
  Linha de matéria da tela Estudar (tela 14). Não é um InsetRow.

  A régua de 52/56/60 do InsetRow vale para linha de uma ou duas alturas de
  texto, e ela proíbe padding vertical de propósito. Esta linha tem TRÊS blocos
  (nome, disciplina em caixa alta, pílulas) e o handoff a desenha com
  padding 12/16 e min-height 64 — uma exceção medida, não um descuido. Forçá-la
  dentro do InsetRow quebraria a régua para todas as outras telas.

  O separador entra a 38px: 16 da margem + 10 do ponto + 12 do gap.
*/

export function MateriaRow({
  id,
  nome,
  disciplina,
  dominioPct,
  streakDias,
  semMaterial,
}: {
  id: string;
  nome: string;
  disciplina: string;
  /** null quando a matéria ainda não tem quiz respondido. */
  dominioPct: number | null;
  streakDias: number;
  semMaterial: boolean;
}) {
  const cor = professorColor(id);
  const dominio = dominioPct === null ? null : pctInteiro(dominioPct);

  return (
    <Link
      href={`/professor/${id}`}
      className={cn(
        "relative flex min-h-[64px] items-center gap-3 px-4 py-3 text-tinta",
        "transition-colors duration-140 ease-out hover:bg-indigo/5",
        "focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte"
      )}
    >
      {/* Cor de matéria só como ponto — 10px nesta linha. */}
      <span aria-hidden className={cn("h-2.5 w-2.5 flex-none rounded-capsula", cor.bg)} />

      <span className="min-w-0 flex-1">
        <span className="block truncate text-linha font-semibold">{nome}</span>
        <span className="mt-0.5 block truncate text-[11px] font-semibold uppercase tracking-[0.06em] text-tinta-fraca">
          {disciplina}
        </span>

        {semMaterial ? (
          <span className="mt-1.5 block text-nota text-tinta-fraca">
            Ainda sem material, envie a apostila pra começar
          </span>
        ) : (
          (dominio !== null || streakDias > 0) && (
            <span className="mt-[7px] flex flex-wrap items-center gap-2">
              {dominio !== null && (
                <Pill tone={tonePilulaDaNota(dominio)}>
                  <MetricText>{dominio}%</MetricText>
                  você já domina
                </Pill>
              )}
              {streakDias > 0 && (
                <span className="inline-flex items-center gap-1 text-[12px] text-tinta-fraca">
                  <Flame className="h-[13px] w-[13px]" />
                  <MetricText tone="fraca">{streakDias}</MetricText>
                  {streakDias === 1 ? "dia" : "dias"}
                </span>
              )}
            </span>
          )
        )}
      </span>

      <ChevronRight className="h-[14px] w-[14px] flex-none text-borda-forte" aria-hidden />

      <span aria-hidden data-sep className="pointer-events-none absolute bottom-0 left-[38px] right-0 h-[0.5px] bg-borda" />
    </Link>
  );
}
