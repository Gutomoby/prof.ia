"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, FileText, ListChecks, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Capsule } from "@/components/ui/capsule";
import { InlineAlert } from "@/components/ui/inline-alert";
import { MetricText } from "@/components/ui/metric-text";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/*
  Tela 26 · Apagar a matéria.

  Folha de baixo, não página: apagar é um desvio, e mantendo os Ajustes atrás
  cancelar devolve exatamente onde a pessoa estava.

  A confirmação pede o nome digitado em vez de um "tem certeza?": obriga a
  olhar QUAL matéria está sendo apagada, o que importa quando se limpa várias
  seguidas. E a lista do que se perde vem com número — "3 materiais" assusta na
  medida certa, "seus materiais" não diz nada.
*/

function LinhaPerda({ icone, children }: { icone: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="relative flex items-center gap-3 px-3.5 py-2.5">
      <span className="flex h-[18px] w-[18px] flex-none items-center justify-center text-erro [&>svg]:h-[18px] [&>svg]:w-[18px]">
        {icone}
      </span>
      <span className="flex-1 text-corpo text-tinta">{children}</span>
    </div>
  );
}

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
  const [aberta, setAberta] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nomeConfere = confirmText.trim().toLowerCase() === professorName.trim().toLowerCase();

  function fechar() {
    if (deleting) return;
    setAberta(false);
    setConfirmText("");
    setError(null);
  }

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
        Some com a matéria e com tudo que veio junto. Não dá para desfazer.
      </p>

      <button
        type="button"
        onClick={() => setAberta(true)}
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

      <Sheet aberta={aberta} onFechar={fechar} titulo={`Apagar ${professorName}`}>
        <div className="text-center">
          <span className="mx-auto flex h-[76px] w-[76px] items-center justify-center rounded-grupo bg-erro/12 text-erro">
            <Trash2 className="h-8 w-8" />
          </span>
          <h2 className="mt-3.5 text-pretty text-titulo-vazio text-tinta">
            Apagar {professorName}?
          </h2>
          <p className="mx-auto mt-2 max-w-[36ch] text-pretty text-corpo text-tinta-fraca">
            Isso remove a matéria e tudo que veio com ela. Não dá para desfazer.
          </p>
        </div>

        <div className="mt-4 overflow-hidden rounded-cartao bg-erro/8">
          {nMateriais !== undefined && (
            <LinhaPerda icone={<FileText />}>
              <MetricText weight="bold">{nMateriais}</MetricText>{" "}
              {nMateriais === 1 ? "material indexado" : "materiais indexados"}
            </LinhaPerda>
          )}
          {nQuizzes !== undefined && (
            <LinhaPerda icone={<ListChecks />}>
              <MetricText weight="bold">{nQuizzes}</MetricText>{" "}
              {nQuizzes === 1 ? "quiz e a nota dele" : "quizzes e as notas deles"}
            </LinhaPerda>
          )}
          <LinhaPerda icone={<CalendarDays />}>
            Plano de estudos e eventos do calendário
          </LinhaPerda>
        </div>

        <label className="mt-4 block">
          <span className="text-nota text-tinta-fraca">
            Para confirmar, escreva <span className="font-semibold text-tinta">{professorName}</span>
            :
          </span>
          <input
            autoFocus
            autoComplete="off"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={professorName}
            className={cn(
              "mt-1.5 h-12 w-full rounded-chip bg-white px-3.5 text-linha text-tinta",
              "shadow-[inset_0_0_0_1px_hsl(var(--erro)/0.35)] placeholder:text-borda-forte",
              "focus:outline-none focus-visible:shadow-foco-forte"
            )}
          />
        </label>

        {error && (
          <div className="mt-3">
            <InlineAlert>{error}</InlineAlert>
          </div>
        )}

        <button
          type="button"
          disabled={!nomeConfere || deleting}
          onClick={handleDelete}
          className={cn(
            "mt-4 flex h-capsula-principal w-full items-center justify-center rounded-capsula",
            "bg-erro text-linha font-semibold text-papel",
            "transition-all duration-180 ease-out hover:bg-[hsl(0_72%_34%)] active:scale-[0.98]",
            "focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte",
            "disabled:pointer-events-none disabled:opacity-40"
          )}
        >
          {deleting ? "Apagando..." : "Apagar definitivamente"}
        </button>

        <Capsule variant="texto" block className="mt-1" disabled={deleting} onClick={fechar}>
          Cancelar
        </Capsule>
      </Sheet>
    </>
  );
}
