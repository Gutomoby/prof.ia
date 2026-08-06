"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, CalendarPlus, Check, FileText, ListChecks, Loader2, TriangleAlert } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Capsule } from "@/components/ui/capsule";
import { InlineAlert } from "@/components/ui/inline-alert";
import { InsetList, InsetRow } from "@/components/ui/inset-list";
import { Skeleton } from "@/components/ui/skeleton";
import { useSetHeaderAction } from "@/components/layout/HeaderActionContext";
import { DeleteProfessor } from "@/components/professor/DeleteProfessor";
import { PainelAuxiliar, PainelLinha, PainelPrincipal } from "@/components/layout/Painel";
import { cn } from "@/lib/utils";
import type { Professor } from "@/lib/types";

/*
  Tela 25 · Ajustes da matéria.

  O formulário é uma inset grouped list com rótulo à esquerda e o valor
  editável à direita, no padrão do iOS — não uma pilha de campos rotulados. E o
  "Salvar" mora no canto superior direito, via HeaderActionContext, porque é
  onde o handoff o coloca e porque o cabeçalho é do layout, não desta página.
*/

function CampoLinha({
  rotulo,
  ultimo = false,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { rotulo: string; ultimo?: boolean }) {
  return (
    <label className="relative flex min-h-linha-campo items-center gap-3 px-4">
      <span className="w-[92px] flex-none text-linha text-tinta-fraca">{rotulo}</span>
      <input
        {...props}
        className="min-w-0 flex-1 bg-transparent text-linha font-medium text-tinta focus:outline-none placeholder:text-borda-forte"
      />
      {!ultimo && (
        <span aria-hidden className="pointer-events-none absolute bottom-0 left-4 right-0 h-[0.5px] bg-borda" />
      )}
    </label>
  );
}

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

  const [contagens, setContagens] = useState<{ materiais: number; quizzes: number } | null>(null);

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
    // O aviso de exclusão diz QUANTO se perde. Número concreto assusta na
    // medida certa; "seus materiais" não diz nada.
    Promise.all([api.listDocuments(professorId), api.listAtividades(professorId, "quiz")])
      .then(([docs, quizzes]) =>
        setContagens({ materiais: docs.items.length, quizzes: quizzes.items.length })
      )
      .catch(() => setContagens(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professorId]);

  const semMudanca =
    professor !== null &&
    name.trim() === professor.name &&
    discipline.trim() === professor.discipline &&
    (teachingStyle.trim() || null) === (professor.teaching_style ?? null) &&
    (examDates.trim() || null) === (professor.exam_dates ?? null);

  const podeSalvar = !semMudanca && Boolean(name.trim()) && Boolean(discipline.trim()) && !saving;

  async function salvar() {
    if (!podeSalvar) return;
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
      // O nome aparece no cabeçalho, na sidebar e na home — todos vindos de
      // server components, então precisam ser refeitos.
      router.refresh();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Falha ao salvar as alterações.");
    } finally {
      setSaving(false);
    }
  }

  // "Salvar" no canto do cabeçalho. Some quando não há o que salvar — um botão
  // permanentemente cinza vira ruído; o que confirma que gravou é o "Salvo".
  useSetHeaderAction(
    saving ? (
      <span className="flex items-center gap-1.5 pr-1 text-[17px] font-semibold text-tinta-fraca">
        <Loader2 className="h-4 w-4 animate-spin" />
        Salvando
      </span>
    ) : saved && semMudanca ? (
      <span className="flex items-center gap-1.5 pr-1 text-[17px] font-semibold text-acerto">
        <Check className="h-[18px] w-[18px]" />
        Salvo
      </span>
    ) : podeSalvar ? (
      <button
        type="button"
        onClick={salvar}
        className="rounded-chip px-2 py-1 text-[17px] font-semibold text-indigo hover:bg-indigo/6 focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte"
      >
        Salvar
      </button>
    ) : null,
    [saving, saved, semMudanca, podeSalvar, name, discipline, teachingStyle, examDates]
  );

  if (loading) {
    return (
      <div className="mx-auto flex max-w-[560px] flex-col gap-4">
        <Skeleton className="h-[200px] rounded-grupo" />
        <Skeleton className="h-[120px] rounded-grupo" />
      </div>
    );
  }

  if (loadError || !professor) {
    return (
      <InlineAlert>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>{loadError ?? "Professor não encontrado."}</span>
          <Capsule variant="secundaria" onClick={load}>
            Tentar novamente
          </Capsule>
        </div>
      </InlineAlert>
    );
  }

  return (
    /*
      66 · Ajustes no computador: os campos na coluna larga e, na auxiliar de
      400px, o que a matéria tem hoje e a zona de perigo. Pôr o "apagar" ao
      lado dos números que ele leva junto é o que a 66 faz — e é mais honesto
      que escondê-lo no fim da rolagem.
    */
    <div className="mx-auto flex w-full max-w-[560px] flex-col md:max-w-none">
      <PainelLinha className="md:items-start">
        <PainelPrincipal className="gap-[22px]">
      <p className="-mt-2 text-pretty text-[14px] leading-[1.45] text-tinta-fraca">
        Editar não apaga nada: material e histórico continuam como estão.
      </p>

      <InsetList label="Dados do professor">
        <CampoLinha
          rotulo="Nome"
          required
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
          placeholder="Prof. Atuária"
        />
        <CampoLinha
          rotulo="Matéria"
          required
          value={discipline}
          onChange={(e) => {
            setDiscipline(e.target.value);
            setSaved(false);
          }}
          placeholder="Ciências Atuariais"
        />
        {/* Estilo de ensino sai da régua de 56px: o texto é livre e costuma
            passar de uma linha, então vira bloco com o rótulo em cima. */}
        <div className="px-4 pb-3.5 pt-3">
          <p className="text-linha text-tinta-fraca">Estilo de ensino</p>
          <input
            value={teachingStyle}
            onChange={(e) => {
              setTeachingStyle(e.target.value);
              setSaved(false);
            }}
            placeholder="objetivo, com muitos exemplos"
            aria-label="Estilo de ensino"
            className="mt-1 w-full bg-transparent text-linha font-medium leading-[1.4] text-tinta focus:outline-none placeholder:text-borda-forte"
          />
          <p className="mt-1.5 text-nota leading-[1.4] text-tinta-fraca">
            Entra nas instruções que o professor recebe ao gerar quizzes e planos.
          </p>
        </div>
      </InsetList>

      <InsetList label="Provas">
        <label className="relative flex min-h-linha-campo items-center gap-3 px-4">
          <span
            aria-hidden
            className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-icone bg-erro/12 text-erro"
          >
            <CalendarDays className="h-4 w-4" />
          </span>
          <span className="flex-none text-linha text-tinta">Datas de prova</span>
          <input
            value={examDates}
            onChange={(e) => {
              setExamDates(e.target.value);
              setSaved(false);
            }}
            placeholder="P3 em 12/08"
            aria-label="Datas de prova"
            className="min-w-0 flex-1 bg-transparent text-right text-corpo text-tinta-fraca focus:outline-none placeholder:text-borda-forte"
          />
          <span aria-hidden className="pointer-events-none absolute bottom-0 left-[58px] right-0 h-[0.5px] bg-borda" />
        </label>
        <InsetRow
          href="/calendario"
          altura="dupla"
          icon={<CalendarPlus />}
          title="Marcar no calendário"
          subtitle="Texto acima é só informativo"
          trailing={<span aria-hidden className="text-borda-forte">›</span>}
        />
      </InsetList>

      {saveError && <InlineAlert>{saveError}</InlineAlert>}
        </PainelPrincipal>

        <PainelAuxiliar largura={400} className="mt-[22px] md:mt-0">
          {/* "Esta matéria tem": os mesmos números que o apagar leva junto,
              contados uma vez só (ver `contagens`). */}
          {contagens && (
            <InsetList label="Esta matéria tem">
              <InsetRow
                icon={<FileText />}
                title="Materiais lidos"
                value={String(contagens.materiais)}
              />
              <InsetRow
                icon={<ListChecks />}
                title="Quizzes feitos"
                value={String(contagens.quizzes)}
              />
            </InsetList>
          )}

      {/* Zona de perigo: contorno vermelho a 30%, nunca fundo vermelho. */}
      <div
        className={cn(
          "rounded-grupo bg-white/70 p-4",
          "shadow-[inset_0_0_0_1px_hsl(var(--erro)/0.3)]"
        )}
      >
        <p className="flex items-center gap-2 text-corpo font-semibold text-erro">
          <TriangleAlert className="h-4 w-4" />
          Apagar esta matéria
        </p>
        <DeleteProfessor
          professorId={professorId}
          professorName={professor.name}
          nMateriais={contagens?.materiais}
          nQuizzes={contagens?.quizzes}
        />
      </div>
        </PainelAuxiliar>
      </PainelLinha>
    </div>
  );
}
