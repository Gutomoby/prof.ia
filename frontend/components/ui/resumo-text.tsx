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

  Link continua de fora — não apareceu em produção. Tabela apareceu apesar da
  tool description pedir pra não usar ("sem link, sem tabela") — Haiku nem
  sempre obedece, e é o jeito mais natural de resumir "conceito → fórmula →
  quando usar", então em vez de insistir só no prompt, também tratamos aqui.
*/

const TITULO = /^(#{2,4})\s+(.+)$/;
const DIVISOR = /^-{3,}$/;
const ITEM_NAO_ORDENADO = /^[-*]\s+(.+)$/;
// Captura o número escrito ("1.", "2."...) — precisa sobreviver mesmo
// quando um "- " no meio interrompe a sequência (ver comentário abaixo em
// ItemOrdenado), senão cada pedaço reinicia em 1.
const ITEM_ORDENADO = /^(\d+)\.\s+(.+)$/;
const LINHA_TABELA = /^\|(.+)\|$/;
// Linha separadora do cabeçalho ("|---|---|" ou "|:--|--:|") — só traço,
// dois-pontos, espaço e pipe. Sem isso não dá pra distinguir uma tabela de
// duas linhas que por acaso começam e terminam com "|".
const SEPARADOR_TABELA = /^\|[\s:|-]+\|$/;

type ItemOrdenado = { n: number; texto: string };

type Bloco =
  | { tipo: "titulo"; nivel: number; texto: string }
  | { tipo: "divisor" }
  | { tipo: "lista"; ordenada: false; itens: string[] }
  | { tipo: "lista"; ordenada: true; itens: ItemOrdenado[] }
  | { tipo: "tabela"; cabecalho: string[]; linhas: string[][] }
  | { tipo: "paragrafo"; linha: string };

function celulasDeLinha(linha: string): string[] {
  return linha.slice(1, -1).split("|").map((c) => c.trim());
}

function agruparBlocos(texto: string): Bloco[] {
  const linhas = texto.split("\n").map((l) => l.trim());
  const blocos: Bloco[] = [];

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    if (!linha) continue; // linha em branco só separa blocos, não vira bloco vazio

    if (LINHA_TABELA.test(linha) && SEPARADOR_TABELA.test(linhas[i + 1] ?? "")) {
      const cabecalho = celulasDeLinha(linha);
      const corpo: string[][] = [];
      let j = i + 2;
      while (LINHA_TABELA.test(linhas[j] ?? "")) {
        corpo.push(celulasDeLinha(linhas[j]));
        j++;
      }
      blocos.push({ tipo: "tabela", cabecalho, linhas: corpo });
      i = j - 1;
      continue;
    }

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
        if (b.tipo === "tabela") {
          return (
            <div key={i} className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-corpo">
                <thead>
                  <tr>
                    {b.cabecalho.map((celula, j) => (
                      <th key={j} className="border-b border-borda px-2 py-1.5 font-bold text-tinta">
                        <Trecho tokens={tokenizarLinha(celula)} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {b.linhas.map((linha, k) => (
                    <tr key={k}>
                      {linha.map((celula, j) => (
                        <td key={j} className="border-b border-borda px-2 py-1.5 align-top text-tinta">
                          <Trecho tokens={tokenizarLinha(celula)} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
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
