"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus, GraduationCap } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardFooter } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProfessorListItem } from "@/lib/types";

export default function DashboardPage() {
  const [professors, setProfessors] = useState<ProfessorListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listProfessors();
      setProfessors(res.items);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Não foi possível carregar seus professores. O backend está no ar?"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <PageHeader
        title="Seus professores"
        action={
          <Link href="/professor/novo" className={buttonVariants("default", "default")}>
            <Plus className="h-4 w-4" />
            Novo professor
          </Link>
        }
      />

      {loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
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

      {!loading && !error && professors.length === 0 && (
        <EmptyState
          icon={GraduationCap}
          title="Você ainda não criou nenhum professor"
          description="Comece cadastrando o primeiro assunto que você quer estudar."
          action={
            <Link href="/professor/novo" className={buttonVariants("default", "default")}>
              <Plus className="h-4 w-4" />
              Criar seu primeiro professor
            </Link>
          }
        />
      )}

      {!loading && !error && professors.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {professors.map((p) => (
            <Card key={p.id} className="flex flex-col overflow-hidden">
              <Link
                href={`/professor/${p.id}/inicio`}
                className="block flex-1 space-y-1.5 p-6 transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              >
                <h3 className="text-base font-semibold leading-none tracking-tight">{p.name}</h3>
                <p className="text-sm text-muted-foreground">{p.discipline}</p>
              </Link>
              <CardFooter className="gap-2 border-t pt-3">
                <Link href={`/professor/${p.id}/quiz`} className={buttonVariants("ghost", "sm", "flex-1")}>
                  Quiz
                </Link>
                <Link href={`/professor/${p.id}/configurar`} className={buttonVariants("ghost", "sm", "flex-1")}>
                  Material
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
