"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { InlineAlert } from "@/components/ui/inline-alert";
import { PageHeader } from "@/components/layout/PageHeader";

export default function NovoProfessorPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [teachingStyle, setTeachingStyle] = useState("");
  const [examDates, setExamDates] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const professor = await api.createProfessor({
        name,
        discipline,
        teaching_style: teachingStyle || null,
        exam_dates: examDates || null,
      });
      router.push(`/professor/${professor.id}/configurar`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao criar o professor.");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Novo professor" backHref="/dashboard" />
      <Card>
        <CardHeader>
          <CardTitle>Cadastrar assunto</CardTitle>
          <CardDescription>
            Defina o professor virtual — depois disso você sobe o material dele.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do professor</Label>
              <Input
                id="name"
                required
                placeholder="Ex.: Prof. Carlos"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="discipline">Matéria</Label>
              <Input
                id="discipline"
                required
                placeholder="Ex.: Atuária"
                value={discipline}
                onChange={(e) => setDiscipline(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="teaching_style">Estilo de ensino (opcional)</Label>
              <Input
                id="teaching_style"
                placeholder="Ex.: objetivo, usa muitos exemplos"
                value={teachingStyle}
                onChange={(e) => setTeachingStyle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exam_dates">Datas de prova (opcional)</Label>
              <Textarea
                id="exam_dates"
                placeholder="Ex.: Prova 1 em 15/09, Prova 2 em 20/11"
                value={examDates}
                onChange={(e) => setExamDates(e.target.value)}
              />
            </div>
            {error && <InlineAlert>{error}</InlineAlert>}
            <Button type="submit" loading={loading}>
              {loading ? "Criando..." : "Criar professor"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
