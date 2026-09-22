"use client";

import * as React from "react";
import katex from "katex";

/*
  Peças de baixo nível compartilhadas entre ChatText e ResumoText: achar
  **negrito** e fórmula $...$ dentro de uma linha, e desenhar o resultado.
  Cada tela decide sozinha quais blocos (lista, título, divisor) monta em
  cima disso — ver o comentário de cada arquivo pra saber o porquê do corte.
*/

const BOLD = /\*\*((?:(?!\*\*).)+)\*\*/g;
// Sem excluir \n de propósito: aqui já operamos por LINHA (o texto é
// quebrado em linhas antes de chegar aqui), então uma fórmula nunca
// atravessa a regex de qualquer forma.
const FORMULA = /(?<!\\)\$((?:[^$\\]|\\.)+?)(?<!\\)\$/g;

export type Token = { tipo: "texto" | "negrito" | "math"; valor: string };

export function desescapar(texto: string): string {
  return texto.replace(/\\\$/g, "$");
}

/** Acha bold e fórmula na linha, na ordem em que aparecem, sem sobrepor. */
export function tokenizarLinha(linha: string): Token[] {
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

export function Trecho({ tokens }: { tokens: Token[] }) {
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
