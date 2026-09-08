"use client";

import * as React from "react";
import katex from "katex";
import { cn } from "@/lib/utils";

/*
  Texto do Chat — MathText + um pouco de Markdown.

  O resto do app (quiz, resumo, prova) usa MathText puro: texto curto,
  tool-forced, sem markdown nenhum. O Chat é diferente — é geração livre, sem
  tool-forcing (ver _shared/claude.ts::generateChatReply), e o modelo cai no
  hábito natural de qualquer chat: **negrito**, listas com "- item". Sem
  processar isso, "**UDD**" e "- $x$ = y" apareciam literais na bolha, cheios
  de asterisco e traço.

  Ainda assim NÃO é um Markdown completo — só bold e lista, os dois padrões
  que realmente apareceram em produção. Cabeçalho, link, tabela continuam
  saindo como texto puro de propósito: não vale o risco de um ## viés virar
  título gigante dentro de uma bolha de chat.
*/

const BOLD = /\*\*((?:(?!\*\*).)+)\*\*/g;
// Mesma regra de math-text.tsx, mas sem excluir \n — aqui já operamos por
// LINHA (a mensagem é quebrada em linhas antes), então uma fórmula nunca
// atravessa a regex; a exclusão de \n em math-text.tsx existia só pra não
// deixar um "$" solto de dinheiro engolir o resto do parágrafo.
const FORMULA = /(?<!\\)\$((?:[^$\\]|\\.)+?)(?<!\\)\$/g;

type Token = { tipo: "texto" | "negrito" | "math"; valor: string };

function desescapar(texto: string): string {
  return texto.replace(/\\\$/g, "$");
}

/** Acha bold e fórmula na linha, na ordem em que aparecem, sem sobrepor. */
function tokenizarLinha(linha: string): Token[] {
  type Achado = { inicio: number; fim: number; tipo: "negrito" | "math"; valor: string };
  const achados: Achado[] = [];
  for (const m of linha.matchAll(BOLD)) {
    achados.push({ inicio: m.index ?? 0, fim: (m.index ?? 0) + m[0].length, tipo: "negrito", valor: m[1] });
  }
  for (const m of linha.matchAll(FORMULA)) {
    achados.push({ inicio: m.index ?? 0, fim: (m.index ?? 0) + m[0].length, tipo: "math", valor: m[1] });
  }
  achados.sort((a, b) => a.inicio - b.inicio);

  const semSobreposicao: Achado[] = [];
  let cursor = 0;
  for (const a of achados) {
    if (a.inicio < cursor) continue;
    semSobreposicao.push(a);
    cursor = a.fim;
  }

  const tokens: Token[] = [];
  let ultimo = 0;
  for (const a of semSobreposicao) {
    if (a.inicio > ultimo) tokens.push({ tipo: "texto", valor: desescapar(linha.slice(ultimo, a.inicio)) });
    tokens.push({ tipo: a.tipo, valor: a.valor });
    ultimo = a.fim;
  }
  if (ultimo < linha.length) tokens.push({ tipo: "texto", valor: desescapar(linha.slice(ultimo)) });
  return tokens;
}

function Trecho({ tokens }: { tokens: Token[] }) {
  return (
    <>
      {tokens.map((t, i) => {
        if (t.tipo === "texto") return <React.Fragment key={i}>{t.valor}</React.Fragment>;
        if (t.tipo === "negrito") return <strong key={i}>{desescapar(t.valor)}</strong>;
        return (
          <span
            key={i}
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{
              __html: katex.renderToString(t.valor, {
                throwOnError: false,
                displayMode: false,
                output: "html",
                strict: false,
              }),
            }}
          />
        );
      })}
    </>
  );
}

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
