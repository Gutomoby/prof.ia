"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, FileText, GraduationCap, Search, SearchX, Type, Upload, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Capsule } from "@/components/ui/capsule";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineAlert } from "@/components/ui/inline-alert";
import { InsetList, InsetRow } from "@/components/ui/inset-list";
import { Tabela, TabelaLinha, type Coluna } from "@/components/ui/tabela";
import { MetricText } from "@/components/ui/metric-text";
import { Skeleton } from "@/components/ui/skeleton";
import { professorColor } from "@/lib/professor-color";
import { cn } from "@/lib/utils";
import type { DocumentWithProfessor } from "@/lib/types";

/*
  Tela 17 · Biblioteca, com os vazios 18 (nada ainda) e 19 (busca sem
  resultado).

  A linha aqui usa o ícone SIMPLES do InsetRow, não o quadrado de 30px: são
  arquivos, e um quadrado colorido por linha viraria mosaico. A identidade da
  matéria já está no cabeçalho do grupo, como ponto.
*/

// Larguras da 61: só o nome do arquivo estica.
const COLUNAS: Coluna[] = [
  { rotulo: "Arquivo", largura: "min-w-0 flex-1" },
  { rotulo: "Matéria", largura: "w-[190px] flex-none" },
  { rotulo: "Enviado", largura: "w-[78px] flex-none" },
];

function CabecalhoGrupo({ id, nome, disciplina }: { id: string; nome: string; disciplina: string }) {
  const cor = professorColor(id);
  return (
    <Link
      href={`/professor/${id}`}
      className={cn(
        "mb-2 ml-4 flex items-center gap-2 rounded-chip py-0.5 pr-2",
        "focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte"
      )}
    >
      <span aria-hidden className={cn("h-2.5 w-2.5 flex-none rounded-capsula", cor.bg)} />
      <span className="truncate text-[14px] font-semibold text-tinta">{nome}</span>
      <span className="truncate text-[11px] font-semibold uppercase tracking-[0.06em] text-tinta-fraca">
        {disciplina}
      </span>
    </Link>
  );
}

function LinhaDocumento({ doc, curto = false }: { doc: DocumentWithProfessor; curto?: boolean }) {
  const data = new Date(doc.created_at);
  return (
    <InsetRow
      href={`/professor/${doc.professor_id}/configurar`}
      icon={doc.type === "pdf" ? <FileText /> : <Type />}
      iconVariant="simples"
      title={doc.name}
      value={
        <MetricText className="text-nota" tone="fraca">
          {curto
            ? data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
            : data.toLocaleDateString("pt-BR")}
        </MetricText>
      }
    />
  );
}

export default function BibliotecaPage() {
  const [items, setItems] = useState<DocumentWithProfessor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listAllDocuments();
      setItems(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível carregar seus materiais.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Agrupado por matéria, preservando a ordem em que os professores aparecem
  // (a API já devolve os documentos mais recentes primeiro).
  const grupos = useMemo(() => {
    const termo = query.trim().toLowerCase();
    const filtrados = termo
      ? items.filter(
          (d) =>
            d.name.toLowerCase().includes(termo) ||
            d.professor_name.toLowerCase().includes(termo) ||
            d.discipline.toLowerCase().includes(termo)
        )
      : items;

    const map = new Map<string, { professor: DocumentWithProfessor; docs: DocumentWithProfessor[] }>();
    for (const doc of filtrados) {
      const grupo = map.get(doc.professor_id);
      if (grupo) grupo.docs.push(doc);
      else map.set(doc.professor_id, { professor: doc, docs: [doc] });
    }
    return Array.from(map.values());
  }, [items, query]);

  const buscando = query.trim().length > 0;

  return (
    <div className="mx-auto w-full max-w-[720px] md:max-w-none">
      <PageHeader title="Biblioteca" subtitle="Todo o material das suas matérias, num só lugar." />

      {loading && (
        <div className="flex flex-col gap-[22px]">
          <Skeleton className="h-10 rounded-chip" />
          <Skeleton className="h-[140px] rounded-grupo" />
          <Skeleton className="h-[104px] rounded-grupo" />
        </div>
      )}

      {!loading && error && (
        <InlineAlert>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            <Capsule variant="secundaria" onClick={load}>
              Tentar novamente
            </Capsule>
          </div>
        </InlineAlert>
      )}

      {/* 18 · Biblioteca vazia — o Kango e um caminho, nunca um beco. */}
      {!loading && !error && items.length === 0 && (
        <EmptyState
          kango="com estante"
          title="Nada aqui ainda"
          description="Tudo que você subir para qualquer matéria aparece nesta lista, junto: apostila, resumo, prova antiga."
        >
          <InsetList>
            <InsetRow
              href="/dashboard"
              icon={<Upload />}
              iconTone="indigo"
              title="Subir material"
              subtitle="Escolha a matéria e envie um PDF"
              trailing={<ChevronRight className="h-[18px] w-[18px]" />}
            />
            <InsetRow
              href="/materias"
              icon={<GraduationCap />}
              title="Ver minhas matérias"
              subtitle="Comece pela que mais te preocupa"
              trailing={<ChevronRight className="h-[18px] w-[18px]" />}
            />
          </InsetList>
        </EmptyState>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="flex flex-col gap-[22px]">
          {/* Campo de busca: 40px, raio 12, vidro .84. */}
          <div className="relative flex h-10 items-center gap-2 rounded-chip px-3 vidro-cartao shadow-hairline">
            <Search className="h-4 w-4 flex-none text-tinta-fraca" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por arquivo ou matéria..."
              aria-label="Buscar materiais"
              className="min-w-0 flex-1 bg-transparent text-[16px] text-tinta focus:outline-none placeholder:text-borda-forte"
            />
            {buscando && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Limpar a busca"
                className="flex h-6 w-6 flex-none items-center justify-center rounded-capsula text-tinta-fraca hover:bg-cinza-tonal focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* 19 · Busca sem resultado. */}
          {grupos.length === 0 ? (
            <EmptyState
              icon={SearchX}
              size="bloco"
              title={`Nada bate com "${query.trim()}"`}
              description="A busca olha nome do arquivo, professor e matéria. Talvez o material esteja com outro nome."
              action={
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="text-corpo font-medium text-indigo hover:underline focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte"
                >
                  Limpar a busca
                </button>
              }
            >
              <InsetList label="Talvez você queira">
                {items.slice(0, 2).map((doc) => (
                  <LinhaDocumento key={doc.id} doc={doc} curto />
                ))}
              </InsetList>
            </EmptyState>
          ) : (
            <>
              {/*
                61 · Biblioteca no computador: tabela, com a matéria virando
                COLUNA em vez de cabeçalho de grupo. É o que a largura permite
                — no celular, sem espaço para a coluna, o agrupamento é que
                diz de quem é cada arquivo (tela 17).
              */}
              <div className="hidden md:block">
                <Tabela colunas={COLUNAS}>
                  {grupos.flatMap(({ professor, docs }) =>
                    docs.map((doc) => (
                      <TabelaLinha
                        key={doc.id}
                        colunas={COLUNAS}
                        href={`/professor/${doc.professor_id}/configurar`}
                        celulas={[
                          <span key="a" className="flex items-center gap-3">
                            <span
                              aria-hidden
                              className={cn(
                                "flex h-[30px] w-[30px] flex-none items-center justify-center rounded-icone",
                                doc.type === "pdf" ? "bg-indigo text-papel" : "bg-cinza-tonal text-tinta-fraca"
                              )}
                            >
                              {doc.type === "pdf" ? (
                                <FileText className="h-[15px] w-[15px]" />
                              ) : (
                                <Type className="h-[15px] w-[15px]" />
                              )}
                            </span>
                            <span className="truncate">{doc.name}</span>
                          </span>,
                          <span key="m" className="flex items-center gap-2">
                            <span
                              aria-hidden
                              className={cn(
                                "h-2 w-2 flex-none rounded-capsula",
                                professorColor(professor.professor_id).bg
                              )}
                            />
                            <span className="truncate">{professor.discipline}</span>
                          </span>,
                          <MetricText key="e" tone="fraca">
                            {new Date(doc.created_at).toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                            })}
                          </MetricText>,
                        ]}
                      />
                    ))
                  )}
                </Tabela>
              </div>

              <div className="flex flex-col gap-[22px] md:hidden">
                {grupos.map(({ professor, docs }) => (
                  <div key={professor.professor_id}>
                    <CabecalhoGrupo
                      id={professor.professor_id}
                      nome={professor.professor_name}
                      disciplina={professor.discipline}
                    />
                    <InsetList>
                      {docs.map((doc) => (
                        <LinhaDocumento key={doc.id} doc={doc} />
                      ))}
                    </InsetList>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
