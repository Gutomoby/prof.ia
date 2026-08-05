"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { Capsule } from "@/components/ui/capsule";
import { InlineAlert } from "@/components/ui/inline-alert";
import { MetricText } from "@/components/ui/metric-text";
import { cn } from "@/lib/utils";

/*
  Apagar leva junto material, quizzes, plano e eventos — e não tem desfazer.

  A confirmação pede o nome digitado em vez de um window.confirm: obriga a
  olhar QUAL professor está sendo apagado, o que importa quando se está
  limpando vários seguidos. O handoff tem uma tela própria para isso (26); até
  ela existir, a confirmação mora aqui dentro.

  Sem borda própria: quem desenha o cartão de perigo é a tela de ajustes.
*/
export function DeleteProfessor({
  professorId,
  professorName,
  nMateriais,
  nQuizzes,
}: {
  professorId: string;
  professorName: string;
  nMateriais?: number;
  nQuizzes?: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nomeConfere = confirmText.trim().toLowerCase() === professorName.trim().toLowerCase();

  async function handleDelete() {
    setError(null);
    setDeleting(true);
    try {
      await api.deleteProfessor(professorId);
      router.push("/dashboard");
      router.refresh(); // sidebar e home são server components
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao apagar o professor.");
      setDeleting(false);
    }
  }

  return (
    <>
      <p className="mt-[7px] text-pretty text-[13.5px] leading-[1.5] text-tinta-fraca">
        Leva junto{" "}
        {nMateriais !== undefined && (
          <>
            os <MetricText tone="fraca">{nMateriais}</MetricText>{" "}
            {nMateriais === 1 ? "material" : "materiais"},{" "}
          </>
        )}
        {nQuizzes !== undefined && (
          <>
            {nMateriais !== undefined ? "os " : "os "}
            <MetricText tone="fraca">{nQuizzes}</MetricText>{" "}
            {nQuizzes === 1 ? "quiz" : "quizzes"},{" "}
          </>
        )}
        o plano de estudos e os eventos do calendário desta matéria. Não dá para desfazer.
      </p>

      {error && (
        <div className="mt-3">
          <InlineAlert>{error}</InlineAlert>
        </div>
      )}

      {open ? (
        <div className="mt-3 flex flex-col gap-2.5">
          <label className="block">
            <span className="text-nota text-tinta-fraca">
              Digite <span className="font-semibold text-tinta">{professorName}</span> para confirmar
            </span>
            <input
              autoFocus
              autoComplete="off"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={professorName}
              className={cn(
                "mt-1.5 h-11 w-full rounded-chip bg-white px-3 text-linha text-tinta",
                "shadow-hairline placeholder:text-borda-forte",
                "focus:outline-none focus-visible:shadow-foco-forte"
              )}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!nomeConfere || deleting}
              onClick={handleDelete}
              className={cn(
                "flex h-toque flex-1 items-center justify-center rounded-capsula bg-white px-4",
                "text-corpo font-semibold text-erro",
                "shadow-[inset_0_0_0_1px_hsl(var(--erro)/0.35)]",
                "transition-colors duration-140 ease-out hover:bg-erro/6",
                "focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte",
                "disabled:pointer-events-none disabled:opacity-50"
              )}
            >
              {deleting ? "Apagando..." : "Apagar definitivamente"}
            </button>
            <Capsule
              variant="texto"
              disabled={deleting}
              onClick={() => {
                setOpen(false);
                setConfirmText("");
                setError(null);
              }}
            >
              Cancelar
            </Capsule>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "mt-3 flex h-toque w-full items-center justify-center rounded-capsula bg-white px-4",
            "text-corpo font-semibold text-erro",
            "shadow-[inset_0_0_0_1px_hsl(var(--erro)/0.35)]",
            "transition-colors duration-140 ease-out hover:bg-erro/6",
            "focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte"
          )}
        >
          Apagar {professorName}
        </button>
      )}
    </>
  );
}
