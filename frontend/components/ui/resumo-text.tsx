"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Trecho, tokenizarLinha } from "@/components/ui/markdown-lite";

/*
  Texto do Resumo — MathText + Markdown mais completo que o do Chat.

  Diferente da bolha de chat (ver chat-text.tsx), o resumo É um documento
  estruturado de estudo — a IA escreve com cabeçalho de seção, lista
  numerada e linha divisória de propósito (organizar um capítulo inteiro em
  tópicos), e cortar isso pra texto corrido pioraria o material. Achado em
  produção: "## 8. WACC em Mercados Emergentes", "1. **CAPM local:** ..." e
  "---" apareciam literais na tela, cheios de cerquilha e asterisco — o
  resumo nunca tinha ganho tratamento nenhum além do MathText puro (só
  fórmula), diferente do Chat que já tinha bold+lista.

  Link e tabela continuam de fora — não apareceram em produção, e a mesma
  cautela do Chat vale aqui: só processa o que o modelo realmente escreve.
*/

const TITULO = /^(#{2,4})\s+(.+)$/;
const DIVISOR = /^-{3,}$/;
const ITEM_NAO_ORDENADO = /^[-*]\s+(.+)$/;
// Captura o número escrito ("1.", "2."...) — precisa sobreviver mesmo
// quando um "- " no meio interrompe a sequência (ver comentário abaixo em
// ItemOrdenado), senão cada pedaço reinicia em 1.
const ITEM_ORDENADO = /^(\d+)\.\s+(.+)$/;

type ItemOrdenado = { n: number; texto: string };

type Bloco =
  | { tipo: "titulo"; nivel: number; texto: string }
  | { tipo: "divisor" }
  | { tipo: "lista"; ordenada: false; itens: string[] }
  | { tipo: "lista"; ordenada: true; itens: ItemOrdenado[] }
  | { tipo: "paragrafo"; linha: string };

function agruparBlocos(texto: string): Bloco[] {
  const linhas = texto.split("\n").map((l) => l.trim());
  const blocos: Bloco[] = [];

  for (const linha of linhas) {
    if (!linha) continue; // linha em branco só separa blocos, não vira bloco vazio

    const titulo = linha.match(TITULO);
    if (titulo) {
      blocos.push({ tipo: "titulo", nivel: titulo[1].length, texto: titulo[2] });
      continue;
    }
    if (DIVISOR.test(linha)) {
      blocos.push({ tipo: "divisor" });
      continue;
    }
    const naoOrdenado = linha.match(ITEM_NAO_ORDENADO);
    if (naoOrdenado) {
      const ultimo = blocos[blocos.length - 1];
      if (ultimo?.tipo === "lista" && !ultimo.ordenada) ultimo.itens.push(naoOrdenado[1]);
      else blocos.push({ tipo: "lista", ordenada: false, itens: [naoOrdenado[1]] });
      continue;
    }
    const ordenado = linha.match(ITEM_ORDENADO);
    if (ordenado) {
      const item: ItemOrdenado = { n: Number(ordenado[1]), texto: ordenado[2] };
      const ultimo = blocos[blocos.length - 1];
      if (ultimo?.tipo === "lista" && ultimo.ordenada) ultimo.itens.push(item);
      else blocos.push({ tipo: "lista", ordenada: true, itens: [item] });
      continue;
    }
    blocos.push({ tipo: "paragrafo", linha });
  }
  return blocos;
}

export function ResumoText({ children, className }: { children: string | null | undefined; className?: string }) {
  const texto = children ?? "";
  const blocos = React.useMemo(() => agruparBlocos(texto), [texto]);

  if (blocos.length === 0) return null;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {blocos.map((b, i) => {
        if (b.tipo === "titulo") {
          // ## vira o maior título disponível aqui dentro (o nome do módulo já
          // é o h1 do timbrado, lá em cima) — ### e mais fundo afinam a partir daí.
          const Tag = b.nivel === 2 ? "h2" : b.nivel === 3 ? "h3" : "h4";
          return (
            <Tag key={i} className={cn("font-bold text-tinta", b.nivel === 2 ? "mt-1 text-titulo-cartao" : "text-linha")}>
              <Trecho tokens={tokenizarLinha(b.texto)} />
            </Tag>
          );
        }
        if (b.tipo === "divisor") {
          return <div key={i} aria-hidden className="h-px bg-borda" />;
        }
        if (b.tipo === "lista") {
          if (b.ordenada) {
            return (
              <ol key={i} className="list-decimal space-y-1 pl-[22px]">
                {b.itens.map((item, j) => (
                  // value fixa o número que a IA escreveu — sem isso, um "- "
                  // interrompendo a sequência (comum: detalhe logo abaixo de
                  // "1. CAPM local:") faz cada pedaço reiniciar em 1.
                  <li key={j} value={item.n}>
                    <Trecho tokens={tokenizarLinha(item.texto)} />
                  </li>
                ))}
              </ol>
            );
          }
          return (
            <ul key={i} className="list-disc space-y-1 pl-[22px]">
              {b.itens.map((item, j) => (
                <li key={j}>
                  <Trecho tokens={tokenizarLinha(item)} />
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i}>
            <Trecho tokens={tokenizarLinha(b.linha)} />
          </p>
        );
      })}
    </div>
  );
}
