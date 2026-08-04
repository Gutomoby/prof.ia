import { cn } from "@/lib/utils";

/*
  Marca PROVISÓRIA do Kango. Não existe logo, e é decisão de design, não
  pendência: até a identidade fechar, a marca é a palavra "Kango" em SF Pro 700
  índigo — nenhum símbolo desenhado. Quando precisa de ícone, é o "K" num
  quadrado de raio 11.

  Todo lugar que mostra a marca (sidebar, login, landing) importa daqui, então
  a troca acontece neste arquivo só.
*/
export function Brand({
  className,
  icone = false,
}: {
  className?: string;
  /** Mostra o "K" no quadrado antes da palavra. Usado na sidebar. */
  icone?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      {icone && (
        <span
          aria-hidden
          className="flex h-8 w-8 flex-none items-center justify-center rounded-[11px] bg-indigo text-[18px] font-bold text-papel"
        >
          K
        </span>
      )}
      <span className="text-[20px] font-bold tracking-[0.3px] text-indigo" aria-label="Kango">
        Kango
      </span>
    </span>
  );
}
