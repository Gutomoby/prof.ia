import * as React from "react";
import { cn } from "@/lib/utils";

type CardVariant = "default" | "flat" | "elevated";

// default = igual ao Card de sempre (borda + sombra leve) — usado em tudo que
// não foi explicitamente revisado. flat = sem moldura nenhuma (uma seção que
// se separa por espaço/tipografia, não por caixa). elevated = preenchimento
// tonal em vez de sombra (a única "superfície" de verdade de uma tela).
const cardVariantClasses: Record<CardVariant, string> = {
  default: "border bg-card shadow-sm",
  flat: "border-0 bg-transparent shadow-none",
  elevated: "border-0 shadow-none bg-muted/50 dark:bg-muted/25",
};

export function Card({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: CardVariant }) {
  return (
    <div
      className={cn("rounded-xl text-card-foreground", cardVariantClasses[variant], className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-base font-semibold leading-none tracking-tight", className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6 pt-0", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center justify-between p-6 pt-0", className)} {...props} />;
}
