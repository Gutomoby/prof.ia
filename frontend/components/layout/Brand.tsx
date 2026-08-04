import { cn } from "@/lib/utils";

/*
  Wordmark PROVISÓRIO do Kango — a logo oficial ainda não existe.

  Todo lugar que mostra a marca (sidebar, login, landing) importa daqui,
  então quando a logo/asset oficial chegar a troca acontece neste arquivo
  só. Segue a folha de personagem: caixa-alta, K na cor primária.
*/
export function Brand({ className }: { className?: string }) {
  return (
    <span className={cn("font-bold uppercase tracking-tight", className)} aria-label="Kango">
      <span className="text-primary">K</span>ango
    </span>
  );
}
