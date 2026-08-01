"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InlineAlert } from "@/components/ui/inline-alert";

// Apagar leva junto material, quizzes, planos e eventos — e não tem desfazer.
// Por isso a confirmação pede o nome digitado em vez de um window.confirm:
// obriga a olhar QUAL professor está sendo apagado, o que importa quando se
// está limpando vários seguidos.
export function DeleteProfessor({ professorId, professorName }: { professorId: string; professorName: string }) {
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
      router.refresh(); // a sidebar é server component: refaz a lista
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao apagar o professor.");
      setDeleting(false);
    }
  }

  return (
    <section className="rounded-xl border border-destructive/30 p-6">
      <h2 className="text-sm font-semibold text-destructive">Apagar professor</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Remove {professorName} e tudo que veio junto: materiais, quizzes respondidos, plano de estudos e eventos
        de calendário desta matéria. Não dá para desfazer.
      </p>

      {error && (
        <div className="mt-4">
          <InlineAlert>{error}</InlineAlert>
        </div>
      )}

      {open ? (
        <div className="mt-4 space-y-3">
          <div className="space-y-2">
            <Label htmlFor="confirm-nome">
              Digite <span className="font-semibold text-foreground">{professorName}</span> para confirmar
            </Label>
            <Input
              id="confirm-nome"
              autoFocus
              autoComplete="off"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={professorName}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="destructive" disabled={!nomeConfere} loading={deleting} onClick={handleDelete}>
              {!deleting && <Trash2 className="h-4 w-4" />}
              {deleting ? "Apagando..." : "Apagar definitivamente"}
            </Button>
            <Button
              variant="ghost"
              disabled={deleting}
              onClick={() => {
                setOpen(false);
                setConfirmText("");
                setError(null);
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" className="mt-4" onClick={() => setOpen(true)}>
          <Trash2 className="h-4 w-4" />
          Apagar professor
        </Button>
      )}
    </section>
  );
}
