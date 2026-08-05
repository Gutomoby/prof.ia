"use client";

import * as React from "react";
import katex from "katex";

/*
  Texto com fórmula. Tudo que a IA escreve passa por aqui.

  A regra de saída está em backend/services/claude.py (NOTACAO_MATEMATICA): o
  modelo escreve matemática em LaTeX entre cifrões e o resto em texto comum.
  Antes disso ele alternava três notações — Unicode ("qₓ"), ASCII ("A_x^(m)") e
  expoente cru ("(1-qₓ)^t") — e as duas últimas chegavam literais na tela.

  Duas decisões de robustez, porque a fonte é um modelo e não um compilador:

  - `throwOnError: false`. LaTeX inválido vira o próprio texto em vermelho, em
    vez de derrubar a questão inteira. Uma fórmula feia é muito melhor que uma
    tela de erro no meio da lição.
  - Cifrão sem par é tratado como cifrão de verdade. "custa $5" não pode virar
    início de fórmula.

  O HTML vem do KaTeX, não do modelo: com `trust: false` (o padrão) ele não
  emite \href nem \includegraphics, então o texto do modelo nunca vira markup.
*/

// Captura $...$ sem permitir quebra de linha nem cifrão dentro — assim um
// cifrão solto no texto não abre uma fórmula que engole o parágrafo.
const FORMULA = /\$([^$\n]+?)\$/g;

type Parte = { tipo: "texto"; valor: string } | { tipo: "math"; valor: string };

function dividir(texto: string): Parte[] {
  const partes: Parte[] = [];
  let ultimo = 0;
  for (const m of texto.matchAll(FORMULA)) {
    const i = m.index ?? 0;
    if (i > ultimo) partes.push({ tipo: "texto", valor: texto.slice(ultimo, i) });
    partes.push({ tipo: "math", valor: m[1] });
    ultimo = i + m[0].length;
  }
  if (ultimo < texto.length) partes.push({ tipo: "texto", valor: texto.slice(ultimo) });
  return partes;
}

export function MathText({
  children,
  className,
  as: Tag = "span",
}: {
  children: string | null | undefined;
  className?: string;
  as?: "span" | "p" | "div";
}) {
  const partes = React.useMemo(() => dividir(children ?? ""), [children]);

  // Sem fórmula, sai texto puro — nada de span por pedaço à toa.
  if (partes.length === 1 && partes[0].tipo === "texto") {
    return <Tag className={className}>{partes[0].valor}</Tag>;
  }

  return (
    <Tag className={className}>
      {partes.map((p, i) =>
        p.tipo === "texto" ? (
          <React.Fragment key={i}>{p.valor}</React.Fragment>
        ) : (
          <span
            key={i}
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{
              __html: katex.renderToString(p.valor, {
                throwOnError: false,
                displayMode: false,
                output: "html",
                strict: false,
              }),
            }}
          />
        )
      )}
    </Tag>
  );
}

/** True quando o texto tem pelo menos uma fórmula — útil para decidir layout.
 *
 *  Regex própria, sem a flag global: `.test()` numa regex /g avança lastIndex
 *  entre chamadas, e a mesma string alternaria true/false a cada consulta. */
export function temFormula(texto: string | null | undefined): boolean {
  return /\$[^$\n]+?\$/.test(texto ?? "");
}
