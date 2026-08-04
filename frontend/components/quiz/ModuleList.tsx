"use client";

import { useEffect, useState } from "react";
import { BookOpen, Sparkles } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Skeleton } from "@/components/ui/skeleton";
import { scoreBadgeVariant } from "@/lib/utils";
import type { Module } from "@/lib/types";

/*
  Lista de módulos ("capítulos") do material, organizados por IA.
  Clicar em "Gerar quiz" dispara um quiz do módulo inteiro — a dificuldade
  vem do seletor global da tela (via prop onStart).
*/
export function ModuleList({
  professorId,
  onStart,
  starting,
}: {
  professorId: string;
  onStart: (moduleId: string) => void;
  starting: boolean;
}) {
  const [modules, setModules] = useState<Module[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [organizing, setOrganizing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .listModules(professorId)
      .then((res) => !cancelled && setModules(res.items))
      .catch(() => !cancelled && setError("Não foi possível carregar os módulos."));
    return () => {
      cancelled = true;
    };
  }, [professorId]);

  async function organize() {
    setError(null);
    setOrganizing(true);
    try {
      const res = await api.generateModules(professorId);
      setModules(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao organizar o material.");
    } finally {
      setOrganizing(false);
    }
  }

  if (modules === null && !error) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && <InlineAlert>{error}</InlineAlert>}

      {modules !== null && modules.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Organize o material em módulos
            </CardTitle>
            <CardDescription>
              A IA lê tudo o que você subiu e divide em capítulos, do fundamento ao
              avançado. Depois é clicar num módulo para praticar ele inteiro.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={organize} loading={organizing} className="w-full sm:w-auto">
              <Sparkles className="h-4 w-4" />
              {organizing ? "Lendo seu material..." : "Organizar em módulos"}
            </Button>
          </CardContent>
        </Card>
      )}

      {modules !== null &&
        modules.map((m) => (
          <Card key={m.id}>
            <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <span className="metric flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {m.position + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{m.name}</p>
                {m.description && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{m.description}</p>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {m.topics.slice(0, 4).map((t) => (
                    <span key={t} className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                      {t}
                    </span>
                  ))}
                  {m.topics.length > 4 && (
                    <span className="text-[11px] text-muted-foreground">+{m.topics.length - 4}</span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end">
                {m.melhor_score_pct !== null && (
                  <Badge variant={scoreBadgeVariant(m.melhor_score_pct)} className="metric">
                    melhor: {m.melhor_score_pct}%
                  </Badge>
                )}
                <Button size="sm" disabled={starting || organizing} onClick={() => onStart(m.id)}>
                  Gerar quiz
                </Button>
              </div>
            </div>
          </Card>
        ))}

      {modules !== null && modules.length > 0 && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={organize} loading={organizing} disabled={starting}>
            <Sparkles className="h-4 w-4" />
            {organizing ? "Reorganizando..." : "Reorganizar módulos"}
          </Button>
        </div>
      )}
    </div>
  );
}
