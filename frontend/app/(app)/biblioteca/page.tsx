"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FileText, Library, Search, Type } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Skeleton } from "@/components/ui/skeleton";
import { professorColor } from "@/lib/professor-color";
import type { DocumentWithProfessor } from "@/lib/types";

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

  return (
    <div>
      <PageHeader title="Biblioteca" />

      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-10 rounded-lg" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      )}

      {!loading && error && (
        <InlineAlert>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={load}>
              Tentar novamente
            </Button>
          </div>
        </InlineAlert>
      )}

      {!loading && !error && items.length === 0 && (
        <EmptyState
          icon={Library}
          title="Nenhum material ainda"
          description="Tudo que você subir para qualquer professor aparece aqui, junto."
        />
      )}

      {!loading && !error && items.length > 0 && (
        <div className="space-y-8">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por arquivo ou matéria..."
              aria-label="Buscar materiais"
              className="pl-9"
            />
          </div>

          {grupos.length === 0 && (
            <EmptyState icon={Search} title="Nada encontrado" description={`Nenhum material bate com "${query}".`} />
          )}

          {grupos.map(({ professor, docs }) => {
            const color = professorColor(professor.professor_id);
            return (
              <section key={professor.professor_id}>
                <div className="mb-3 flex items-center gap-2">
                  <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${color.bg}`} />
                  <Link
                    href={`/professor/${professor.professor_id}`}
                    className="text-sm font-semibold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {professor.professor_name}
                  </Link>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    {professor.discipline}
                  </span>
                </div>

                <ul className="divide-y divide-border/60 rounded-xl bg-muted/50 px-4 dark:bg-muted/25">
                  {docs.map((doc) => (
                    <li key={doc.id}>
                      <Link
                        href={`/professor/${doc.professor_id}/configurar`}
                        className="flex items-center gap-3 py-3 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {doc.type === "pdf" ? (
                          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        ) : (
                          <Type className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        <span className="min-w-0 flex-1 truncate text-sm">{doc.name}</span>
                        <span className="shrink-0 text-xs metric text-muted-foreground">
                          {new Date(doc.created_at).toLocaleDateString("pt-BR")}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
