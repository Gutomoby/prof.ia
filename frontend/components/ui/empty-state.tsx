import type { LucideIcon } from "lucide-react";
import { KangoPlaceholder } from "@/components/ui/kango-placeholder";
import { cn } from "@/lib/utils";

/*
  Vazio e erro (handoff §09): ícone em quadrado de 76px com raio 26, título,
  uma frase de causa e uma lista de saídas — nunca só "algo deu errado".

  Duas alturas de título, ambas medidas nas telas: 24px quando o vazio mora
  numa tela que já tem large title (18 · Biblioteca vazia, 12 · Sem matéria
  ainda) e 22px quando é o resultado de uma ação dentro da tela (19 · Busca sem
  resultado). O de 30px do guia é das telas de erro centradas, que ainda não
  existem — entram na Fase H.

  O Kango entra no lugar do ícone quando o vazio é um começo, não uma falha:
  "Vazio sempre traz o Kango e um caminho".
*/

export function EmptyState({
  icon: Icon,
  kango,
  title,
  description,
  action,
  size = "tela",
  children,
  className,
}: {
  icon?: LucideIcon;
  /** Estado do mascote ("com estante", "confuso"). Substitui o ícone. */
  kango?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Ação de saída, abaixo de tudo. */
  action?: React.ReactNode;
  size?: "tela" | "bloco";
  /** Lista de saídas — normalmente uma InsetList. */
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center py-8 text-center", className)}>
      {kango !== undefined ? (
        <KangoPlaceholder px={104} estado={kango} />
      ) : (
        Icon && (
          <span className="flex h-[76px] w-[76px] items-center justify-center rounded-grupo bg-cinza-tonal text-tinta-fraca">
            <Icon className="h-8 w-8" strokeWidth={2} />
          </span>
        )
      )}

      <h2
        className={cn(
          "mt-[22px] text-pretty text-tinta",
          size === "tela" ? "text-titulo-vazio" : "text-titulo-cartao"
        )}
      >
        {title}
      </h2>

      {description && (
        <p className="mt-2.5 max-w-[34ch] text-pretty text-corpo text-tinta-fraca">{description}</p>
      )}

      {children && <div className="mt-[22px] w-full">{children}</div>}

      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
