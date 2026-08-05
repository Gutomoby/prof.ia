import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/*
  Tabela do computador (handoff §"Tela grande"): cabeçalho de 44px em rótulo
  de 12 caixa alta, linhas de 56px, colunas de largura fixa e só a primeira
  esticando.

  Ela existe só no `md`. No celular a mesma informação é lista agrupada — não
  é a tabela encolhida, é outro desenho (telas 17 e 24), e as duas convivem
  na página com `md:hidden` / `hidden md:block`.

  A largura mora na definição da coluna e é aplicada nas DUAS pontas, cabeçalho
  e célula, a partir do mesmo objeto: escritas em dois lugares, elas
  desalinham no primeiro ajuste.
*/

export interface Coluna {
  rotulo: string;
  /** Classe de largura. A primeira coluna costuma ser `flex-1 min-w-0`. */
  largura: string;
  /** Alinha o conteúdo à direita — nota, valor. */
  fim?: boolean;
}

export function Tabela({
  colunas,
  children,
  className,
}: {
  colunas: Coluna[];
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="table"
      className={cn(
        "overflow-hidden rounded-grupo vidro-cartao shadow-vidro",
        "[&>*:last-child_[data-sep]]:hidden",
        className
      )}
    >
      <div role="row" className="flex h-11 items-center gap-3 px-[18px]">
        {colunas.map((c) => (
          <span
            key={c.rotulo}
            role="columnheader"
            className={cn(
              "text-rotulo uppercase text-tinta-fraca",
              c.largura,
              c.fim && "text-right"
            )}
          >
            {c.rotulo}
          </span>
        ))}
        {/* Espaço do chevron, para o cabeçalho não sair 14px deslocado. */}
        <span aria-hidden className="w-3.5 flex-none" />
      </div>
      {children}
    </div>
  );
}

export function TabelaLinha({
  colunas,
  celulas,
  href,
}: {
  colunas: Coluna[];
  celulas: React.ReactNode[];
  href?: string;
}) {
  const conteudo = (
    <>
      {celulas.map((celula, i) => (
        <span
          key={colunas[i]?.rotulo ?? i}
          role="cell"
          className={cn(
            "truncate",
            i === 0 ? "text-linha text-tinta" : "text-corpo text-tinta-fraca",
            colunas[i]?.largura,
            colunas[i]?.fim && "flex justify-end"
          )}
        >
          {celula}
        </span>
      ))}
      <ChevronRight
        aria-hidden
        className={cn("h-3.5 w-3.5 flex-none", href ? "text-borda-forte" : "invisible")}
      />
      <span
        aria-hidden
        data-sep
        className="pointer-events-none absolute bottom-0 left-[18px] right-[18px] h-[0.5px] bg-borda"
      />
    </>
  );

  const classes = cn(
    "relative flex min-h-14 w-full items-center gap-3 px-[18px] text-left",
    href && "transition-colors duration-140 ease-out hover:bg-indigo/5",
    href && "focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte"
  );

  if (href) {
    return (
      <Link role="row" href={href} className={classes}>
        {conteudo}
      </Link>
    );
  }
  return (
    <div role="row" className={classes}>
      {conteudo}
    </div>
  );
}
