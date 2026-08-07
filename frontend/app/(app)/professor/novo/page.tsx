"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, FileUp, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Capsule } from "@/components/ui/capsule";
import { GlassCard } from "@/components/ui/glass-card";
import { InlineAlert } from "@/components/ui/inline-alert";
import { InsetList, InsetRow } from "@/components/ui/inset-list";
import { PainelAuxiliar, PainelLinha, PainelPrincipal } from "@/components/layout/Painel";
import { Kango } from "@/components/ui/kango";
import { cn } from "@/lib/utils";

/*
  Tela 15 · Novo professor.

  O formulário é uma inset grouped list, não uma pilha de campos com rótulo em
  cima: o rótulo fica à esquerda e o valor à direita, na mesma linha de 56px.
  É o padrão de formulário do iOS e o que o handoff desenha.

  A cor da matéria não é escolhida aqui — sai do hash do id em
  lib/professor-color.ts, e o id só existe depois de criar. Por isso a prévia
  mostra o ponto em cinza com a nota "o app escolhe a cor".
*/

function CampoLinha({
  rotulo,
  ultimo = false,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { rotulo: string; ultimo?: boolean }) {
  return (
    <label className="relative flex min-h-linha-campo items-center gap-4 px-4">
      <span className="flex-none text-linha text-tinta">{rotulo}</span>
      <input
        {...props}
        className={cn(
          "min-w-0 flex-1 bg-transparent text-right text-linha text-tinta",
          "placeholder:text-borda-forte focus:outline-none"
        )}
      />
      {!ultimo && (
        <span aria-hidden className="pointer-events-none absolute bottom-0 left-4 right-0 h-[0.5px] bg-borda" />
      )}
    </label>
  );
}

export default function NovoProfessorPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [teachingStyle, setTeachingStyle] = useState("");
  const [examDates, setExamDates] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const podeCriar = name.trim().length > 0 && discipline.trim().length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!podeCriar) return;
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
    /*
      62 · Nova matéria no computador: o formulário na coluna larga e, na
      auxiliar de 440px, o que serve como material e o que acontece a seguir.

      A área de arrastar arquivo da 62 NÃO entra aqui, e não é esquecimento:
      documento precisa de professor_id, e o professor só existe depois deste
      formulário. Um dropzone antes disso não teria onde gravar. É por isso
      que a 63 (a mesma tela "lendo o material") também não existe nesta
      rota — quem lê é a tela 56, para onde esta manda assim que cria.
    */
    <form onSubmit={handleSubmit} className="mx-auto w-full max-w-[520px] md:max-w-none">
      <PageHeader
        title="Novo professor"
        backHref="/dashboard"
        backLabel="Professores"
        subtitle="Crie um professor para a matéria. Depois você envia o material dele, apostila, resumo, prova antiga."
      />

      <PainelLinha>
        <PainelPrincipal className="gap-[22px]">
        <InsetList label="Sobre a matéria" superficie="solido">
          <CampoLinha
            rotulo="Nome dele"
            required
            placeholder="Prof. Carlos"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <CampoLinha
            rotulo="Matéria"
            required
            placeholder="Atuária"
            value={discipline}
            onChange={(e) => setDiscipline(e.target.value)}
          />
          <CampoLinha
            rotulo="Como explica"
            placeholder="objetivo, usa muitos exemplos"
            value={teachingStyle}
            onChange={(e) => setTeachingStyle(e.target.value)}
          />
          <CampoLinha
            rotulo="Datas de prova"
            ultimo
            placeholder="Prova 1 em 15/09, Prova 2 em 20/11"
            value={examDates}
            onChange={(e) => setExamDates(e.target.value)}
          />
        </InsetList>

        <p className="-mt-3 px-rotulo-secao text-nota text-tinta-fraca">
          Os dois últimos são opcionais. Com as datas de prova, o Kango treina primeiro o que cai antes.
        </p>

        <div>
          <p className="mb-2 px-rotulo-secao text-rotulo uppercase text-tinta-fraca">
            Como vai ficar na sua lista
          </p>
          <GlassCard className="flex items-center gap-3 p-4">
            <Kango px={44} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span aria-hidden className="h-2.5 w-2.5 flex-none rounded-capsula bg-cinza-tonal" />
                <span className="truncate text-linha font-semibold">
                  {name.trim() || "Prof. Carlos"}
                </span>
              </span>
              <span className="mt-0.5 block truncate text-[11px] font-semibold uppercase tracking-[0.06em] text-tinta-fraca">
                {discipline.trim() || "Atuária"}
              </span>
            </span>
            <span className="flex-none text-nota text-tinta-fraca">o app escolhe a cor</span>
          </GlassCard>
        </div>

        {error && <InlineAlert>{error}</InlineAlert>}

        <div>
          <Capsule type="submit" block loading={loading} disabled={!podeCriar} className="md:w-fit">
            {loading ? "Criando..." : "Criar professor"}
          </Capsule>
          <p className="mt-2 text-center text-nota text-tinta-fraca md:text-left">
            Depois de criar, você envia o material dele.
          </p>
        </div>
        </PainelPrincipal>

        <PainelAuxiliar largura={440} className="mt-[22px] md:mt-0">
          <div className="rounded-grupo bg-white/70 p-[22px] text-center shadow-hairline">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-[18px] bg-indigo/12 text-indigo">
              <FileUp className="h-[26px] w-[26px]" />
            </span>
            <p className="mt-3 text-linha font-semibold">O material vem no passo seguinte</p>
            <p className="mt-1 text-pretty text-nota leading-[1.45] text-tinta-fraca">
              Assim que a matéria existir, a tela de Material abre para você subir a apostila —
              arquivo precisa de matéria para pertencer a alguém.
            </p>
          </div>

          <InsetList label="Serve como material">
            <InsetRow
              icon={<Check strokeWidth={3} />}
              iconVariant="simples"
              iconClass="text-acerto"
              title="Apostila, slide da aula, resumo seu"
            />
            <InsetRow
              icon={<Check strokeWidth={3} />}
              iconVariant="simples"
              iconClass="text-acerto"
              title="Prova antiga e lista de exercícios"
            />
            <InsetRow
              icon={<X strokeWidth={3} />}
              iconVariant="simples"
              iconClass="text-erro"
              title={<span className="text-tinta-fraca">PDF escaneado sem texto (só imagem)</span>}
            />
          </InsetList>
        </PainelAuxiliar>
      </PainelLinha>
    </form>
  );
}
