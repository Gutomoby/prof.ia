"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Skeleton } from "@/components/ui/skeleton";
import { DeleteProfessor } from "@/components/professor/DeleteProfessor";
import type { Professor } from "@/lib/types";

export default function AjustesPage({ params }: { params: { id: string } }) {
  const professorId = params.id;
  const router = useRouter();

  const [professor, setProfessor] = useState<Professor | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [teachingStyle, setTeachingStyle] = useState("");
  const [examDates, setExamDates] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const p = await api.getProfessor(professorId);
      setProfessor(p);
      setName(p.name);
      setDiscipline(p.discipline);
      setTeachingStyle(p.teaching_style ?? "");
      setExamDates(p.exam_dates ?? "");
    } catch (err) {
      setLoadError(
        err instanceof ApiError && err.status === 404
          ? "Professor não encontrado."
          : "Não foi possível carregar este professor."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professorId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaveError(null);
    setSaved(false);
    setSaving(true);
    try {
      const atualizado = await api.updateProfessor(professorId, {
        name: name.trim(),
        discipline: discipline.trim(),
        teaching_style: teachingStyle.trim() || null,
        exam_dates: examDates.trim() || null,
      });
      setProfessor(atualizado);
      setSaved(true);
      // O nome aparece no cabeçalho, na sidebar e no dashboard — todos vindos
      // de server components, então precisam ser refeitos.
      router.refresh();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Falha ao salvar as alterações.");
    } finally {
      setSaving(false);
    }
  }

  const semMudanca =
    professor !== null &&
    name.trim() === professor.name &&
    discipline.trim() === professor.discipline &&
    (teachingStyle.trim() || null) === (professor.teaching_style ?? null) &&
    (examDates.trim() || null) === (professor.exam_dates ?? null);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  if (loadError || !professor) {
    return (
      <div className="mx-auto max-w-2xl">
        <InlineAlert>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{loadError ?? "Professor não encontrado."}</span>
            <Button variant="outline" size="sm" onClick={load}>
              Tentar novamente
            </Button>
          </div>
        </InlineAlert>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Dados do professor</CardTitle>
          <CardDescription>
            Editar aqui não apaga nada: material e histórico de quizzes continuam como estão.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setSaved(false);
                }}
                placeholder="Ex.: Pacheco"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="discipline">Matéria</Label>
              <Input
                id="discipline"
                required
                value={discipline}
                onChange={(e) => {
                  setDiscipline(e.target.value);
                  setSaved(false);
                }}
                placeholder="Ex.: Matemática Atuarial"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="teaching_style">Estilo de ensino</Label>
              <Input
                id="teaching_style"
                value={teachingStyle}
                onChange={(e) => {
                  setTeachingStyle(e.target.value);
                  setSaved(false);
                }}
                placeholder="Ex.: objetivo, com muitos exemplos"
              />
              <p className="text-xs text-muted-foreground">
                Entra nas instruções que o professor recebe ao gerar quizzes e planos.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="exam_dates">Datas de prova</Label>
              <Input
                id="exam_dates"
                value={examDates}
                onChange={(e) => {
                  setExamDates(e.target.value);
                  setSaved(false);
                }}
                placeholder="Ex.: P3 em 12/08"
              />
              <p className="text-xs text-muted-foreground">
                Texto livre, só informativo. Para ver a prova no calendário, marque um evento por lá.
              </p>
            </div>

            {saveError && <InlineAlert>{saveError}</InlineAlert>}

            <div className="flex items-center gap-3">
              <Button type="submit" loading={saving} disabled={semMudanca || !name.trim() || !discipline.trim()}>
                {saving ? "Salvando..." : "Salvar alterações"}
              </Button>
              {saved && !saving && (
                <span className="inline-flex items-center gap-1.5 text-sm text-success">
                  <Check className="h-4 w-4" />
                  Salvo
                </span>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <DeleteProfessor professorId={professorId} professorName={professor.name} />
    </div>
  );
}
