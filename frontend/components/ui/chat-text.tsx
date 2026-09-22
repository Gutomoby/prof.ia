"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Trecho, tokenizarLinha } from "@/components/ui/markdown-lite";

/*
  Texto do Chat — MathText + um pouco de Markdown.

  O resto do app (quiz, prova) usa MathText puro: texto curto, tool-forced,
  sem markdown nenhum. O Chat é diferente — é geração livre, sem tool-forcing
  (ver _shared/claude.ts::generateChatReply), e o modelo cai no hábito
  natural de qualquer chat: **negrito**, listas com "- item". Sem processar
  isso, "**UDD**" e "- $x$ = y" apareciam literais na bolha, cheios de
  asterisco e traço.

  Ainda assim NÃO é um Markdown completo — só bold e lista, os dois padrões
  que realmente apareceram em produção. Cabeçalho, lista numerada, link
  continuam saindo como texto puro de propósito: não vale o risco de um ##
  virar título gigante dentro de uma bolha de chat. O Resumo (ver
  resumo-text.tsx) é o documento estruturado de verdade — lá cabeçalho e
  lista numerada fazem sentido; aqui, não.
*/

const LINHA_LISTA = /^\s*[-*]\s+(.*)$/;

// Uma "linha lógica" pode ser um parágrafo ou um item de lista; agrupa
// itens de lista consecutivos num <ul> só, ao invés de um <ul> por item.
type Bloco = { tipo: "paragrafo"; linha: string } | { tipo: "lista"; itens: string[] };

function agruparBlocos(texto: string): Bloco[] {
  const linhas = texto.split("\n").map((l) => l.trimEnd());
  const blocos: Bloco[] = [];

  for (const linha of linhas) {
    const item = linha.match(LINHA_LISTA);
    if (item) {
      const ultimo = blocos[blocos.length - 1];
      if (ultimo && ultimo.tipo === "lista") ultimo.itens.push(item[1]);
      else blocos.push({ tipo: "lista", itens: [item[1]] });
    } else if (linha.trim()) {
      blocos.push({ tipo: "paragrafo", linha });
    }
    // Linha em branco: só separa blocos, não vira bloco vazio próprio.
  }
  return blocos;
}

export function ChatText({ children, className }: { children: string | null | undefined; className?: string }) {
  const texto = children ?? "";
  const blocos = React.useMemo(() => agruparBlocos(texto), [texto]);

  if (blocos.length === 0) return null;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {blocos.map((b, i) =>
        b.tipo === "lista" ? (
          <ul key={i} className="list-disc space-y-1 pl-[18px]">
            {b.itens.map((item, j) => (
              <li key={j}>
                <Trecho tokens={tokenizarLinha(item)} />
              </li>
            ))}
          </ul>
        ) : (
          <p key={i}>
            <Trecho tokens={tokenizarLinha(b.linha)} />
          </p>
        )
      )}
    </div>
  );
}
