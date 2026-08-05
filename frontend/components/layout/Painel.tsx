import { cn } from "@/lib/utils";

/*
  A gramática do desktop, num lugar só.

  O handoff §"Tela grande" descreve o painel em três regras que se repetem em
  quase todas as 30 telas de computador:

    centro          padding 34px 26px 26px, gap 20 a 22
    coluna auxiliar 250 a 400px, fixa, à direita do conteúdo
    linha           cartões lado a lado, esticados na mesma altura

  Escrever isso à mão em cada tela garante que a décima saia com 24px de gap e
  a décima quinta com a auxiliar de 260px. Aqui a régua é uma só.

  No celular nada disso existe: a linha vira pilha e a auxiliar vira o último
  bloco da pilha. É o mesmo conteúdo na mesma ordem — por isso `PainelLinha` é
  um flex-col que só vira flex-row no `md`, e não dois blocos condicionais.
*/

/** Linha de blocos: pilha no celular, lado a lado no computador. */
export function PainelLinha({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col gap-3 md:flex-row md:items-stretch md:gap-5", className)}
      {...props}
    >
      {children}
    </div>
  );
}

/** O bloco que manda na linha: ocupa o que sobra. */
export function PainelPrincipal({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex min-w-0 flex-1 flex-col", className)} {...props}>
      {children}
    </div>
  );
}

/**
 * Coluna auxiliar de 250px. No celular ela não é coluna: é o resto da pilha,
 * e por isso não leva largura nenhuma até o `md`.
 */
export function PainelAuxiliar({
  className,
  largura = 250,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { largura?: number }) {
  return (
    <div
      // A largura entra por variável em vez de classe porque `md:w-[250px]`
      // com valor vindo de prop não sobrevive ao purge do Tailwind — as
      // classes precisam existir por inteiro no código.
      className={cn(
        "flex flex-col gap-3 md:w-[var(--largura-aux)] md:flex-none md:gap-5",
        className
      )}
      style={{ ["--largura-aux" as string]: `${largura}px` }}
      {...props}
    >
      {children}
    </div>
  );
}
