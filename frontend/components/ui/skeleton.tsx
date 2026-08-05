import { cn } from "@/lib/utils";

/*
  Skeleton do guia §09: barra em cinza tonal pulsando de 1 a .45 em 2s.

  A regra que importa não é a cor, é o uso: "o que já existe no cliente aparece
  de verdade (título, abas, barra de abas); só o que vem da API pulsa, no mesmo
  tamanho do conteúdo final, para a tela não pular". Um retângulo cinza no lugar
  da tela inteira viola as duas metades — mente sobre o que já se sabe e muda de
  altura quando o dado chega.

  `movimento-essencial` porque skeleton é informação: com "reduzir movimento"
  ligado, a regra global de globals.css zeraria a animação e a tela ficaria
  indistinguível de uma tela travada. Lá a exceção troca deslocamento por
  opacidade — e aqui já é opacidade.
*/
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn("movimento-essencial animate-pulsar rounded-capsula bg-cinza-tonal", className)}
      {...props}
    />
  );
}

/** Linha de texto. A largura varia para a mancha não virar um bloco só. */
export function SkeletonLinha({ className }: { className?: string }) {
  return <Skeleton className={cn("h-3.5", className)} />;
}
