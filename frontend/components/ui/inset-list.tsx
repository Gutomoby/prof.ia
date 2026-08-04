import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { MetricText } from "@/components/ui/metric-text";

// Inset grouped list, o componente que carrega quase toda tela do Kango.
//
// Regras que não são negociáveis (handoff §Componentes):
//  - grupo de raio 26 com overflow-hidden, para as linhas serem recortadas;
//  - a linha NUNCA tem padding vertical: a altura vem só do min-height, senão
//    texto de duas linhas empurra a régua de 52/56/60;
//  - separador de 0,5px começando em 58px quando há ícone e 16px quando não há
//    (alinha com o texto, não com a borda), e a última linha não tem separador.

type RowTone = "indigo" | "acerto" | "erro" | "inativo";

// Ícone de linha: quadrado de 30px com raio 12, cheio na cor de estado e
// cinza tonal quando inativo.
const iconToneClasses: Record<RowTone, string> = {
  indigo: "bg-indigo text-papel",
  acerto: "bg-acerto text-papel",
  erro: "bg-erro text-papel",
  inativo: "bg-cinza-tonal text-tinta-fraca",
};

type RowAltura = "simples" | "campo" | "dupla";

const alturaClasses: Record<RowAltura, string> = {
  simples: "min-h-linha", // 52 — linha só com texto
  campo: "min-h-linha-campo", // 56 — com campo ou alternativa
  dupla: "min-h-linha-dupla", // 60 — com subtítulo
};

// Duas formas de ícone convivem nas telas. O quadrado de 30px é o padrão do
// guia; o simples é o da Biblioteca (tela 17), onde a linha é só arquivo e data
// e um quadrado colorido por linha viraria um mosaico. A escolha muda também a
// sangria do separador, que alinha com o texto: 58px depois do quadrado, 45px
// depois do ícone simples.
type IconVariant = "quadrado" | "simples";

export interface InsetRowProps {
  icon?: React.ReactNode;
  iconTone?: RowTone;
  iconVariant?: IconVariant;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Valor à direita. String/número entram em mono automaticamente. */
  value?: React.ReactNode;
  /** Acessório final (chevron, switch). Vem depois do valor. */
  trailing?: React.ReactNode;
  /** Linha selecionada: fundo índigo a 8%, texto 590, valor em índigo 700. */
  active?: boolean;
  /** Sobrescreve a altura derivada (dupla quando há subtítulo, 52 sem). */
  altura?: RowAltura;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

export function InsetRow({
  icon,
  iconTone = "inativo",
  iconVariant = "quadrado",
  title,
  subtitle,
  value,
  trailing,
  active = false,
  altura,
  href,
  onClick,
  disabled = false,
  className,
}: InsetRowProps) {
  const interativa = Boolean(href || onClick) && !disabled;
  const alturaFinal = altura ?? (subtitle ? "dupla" : "simples");

  const conteudo = (
    <>
      {icon && (
        <span
          className={cn(
            "flex flex-none items-center justify-center",
            "[&>svg]:h-[17px] [&>svg]:w-[17px]",
            iconVariant === "quadrado"
              ? cn("h-[30px] w-[30px] rounded-icone", iconToneClasses[iconTone])
              : "text-tinta-fraca"
          )}
          aria-hidden
        >
          {icon}
        </span>
      )}

      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-linha", active && "font-semibold")}>{title}</span>
        {subtitle && <span className="mt-0.5 block truncate text-nota text-tinta-fraca">{subtitle}</span>}
      </span>

      {value !== undefined &&
        (typeof value === "string" || typeof value === "number" ? (
          <MetricText
            className="flex-none text-corpo"
            tone={active ? "indigo" : "fraca"}
            weight={active ? "bold" : "normal"}
          >
            {value}
          </MetricText>
        ) : (
          <span className="flex-none">{value}</span>
        ))}

      {trailing && <span className="flex-none text-tinta-fraca">{trailing}</span>}

      {/* Separador absoluto, sempre alinhado ao texto: 58px com o quadrado
          (16 da margem + 30 do quadrado + 12 do gap), 45px com o ícone simples
          (16 + 17 + 12) e 16px sem ícone nenhum. */}
      <span
        aria-hidden
        data-sep
        className={cn(
          "pointer-events-none absolute bottom-0 right-0 h-[0.5px] bg-borda",
          !icon ? "left-4" : iconVariant === "quadrado" ? "left-[58px]" : "left-[45px]"
        )}
      />
    </>
  );

  const classes = cn(
    // Padding só na horizontal — a altura é do min-height.
    "relative flex w-full items-center gap-3 px-4 text-left text-tinta",
    alturaClasses[alturaFinal],
    active && "bg-indigo/8",
    interativa && "transition-colors duration-140 ease-out hover:bg-indigo/5",
    interativa && "focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte",
    disabled && "opacity-50",
    className
  );

  if (href && !disabled) {
    return (
      <Link href={href} className={classes}>
        {conteudo}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} disabled={disabled} className={classes}>
        {conteudo}
      </button>
    );
  }

  return <div className={classes}>{conteudo}</div>;
}

export interface InsetListProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Rótulo de seção: 12px caixa alta, entra 32px da borda da tela. */
  label?: React.ReactNode;
  /** Nota de pé abaixo do grupo, mesma sangria do rótulo. */
  footnote?: React.ReactNode;
  /** Vidro é o padrão; branco sólido para grupo sobre fundo já translúcido. */
  superficie?: "vidro" | "solido";
}

export function InsetList({
  label,
  footnote,
  superficie = "vidro",
  className,
  children,
  ...props
}: InsetListProps) {
  return (
    <div className="w-full">
      {/* O rótulo entra 32px da borda da tela (16 da margem + 16 do padding do
          grupo), alinhado ao texto da linha. Os 22px de respiro ANTES dele são
          ritmo da pilha, não do componente: quem empilha define o gap, senão
          soma duas vezes. */}
      {label && (
        <p className="mb-2 px-rotulo-secao text-rotulo uppercase text-tinta-fraca">{label}</p>
      )}
      <div
        className={cn(
          "overflow-hidden rounded-grupo",
          // Sem separador na última linha. A regra mora no GRUPO, não na linha:
          // escrita como `last:[&_[data-sep]]:hidden` na linha, o Tailwind
          // compõe o :last-child no próprio separador — que é sempre o último
          // filho da linha — e o esconde em todas.
          "[&>*:last-child_[data-sep]]:hidden",
          superficie === "vidro" ? "vidro-cartao shadow-vidro" : "bg-white shadow-hairline",
          className
        )}
        {...props}
      >
        {children}
      </div>
      {footnote && <p className="mt-2 px-rotulo-secao text-nota text-tinta-fraca">{footnote}</p>}
    </div>
  );
}
