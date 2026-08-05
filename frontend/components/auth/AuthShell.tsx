import Link from "next/link";
import { cn } from "@/lib/utils";

/*
  Casca das telas de conta (01–04 no celular, 46–51 no desktop).

  As duas larguras são desenhos diferentes, não um esticado do outro:

    celular   coluna de altura cheia, padding 0 16px, marca grande no topo
              (Kango 104px + wordmark de 40px), grupo em vidro .86 raio 26,
              botões empilhados de 52px, rodapé colado embaixo.

    desktop   cartão centrado em vidro .9 raio 30 com padding 34 e gap 18,
              marca pequena no canto superior esquerdo, link de troca de fluxo
              no canto direito, grupo em #fff raio 20 com hairline, botões
              sociais lado a lado de 50px.

  O degradê e os halos mudam por tela — os valores abaixo são os do HTML, e os
  halos têm tamanho e posição próprios em cada largura.
*/

// Os degradês moram em globals.css (.fundo-conta-*) porque o "entrar" troca de
// ângulo no desktop e media query não cabe em style inline.
type Fundo = "entrar" | "criar" | "erro" | "recuperar";

const FUNDO_CLASSE: Record<Fundo, string> = {
  entrar: "fundo-conta-entrar",
  criar: "fundo-conta-criar",
  erro: "fundo-conta-erro",
  recuperar: "fundo-conta-recuperar",
};

function halo(cor: string, alfa: number) {
  return `radial-gradient(circle,rgba(${cor},${alfa}),rgba(${cor},0) 70%)`;
}

const INDIGO = "67,56,202";
const TEAL = "15,118,110";
const AMBAR = "180,83,9";

/** [classes de posição/tamanho, gradiente] — celular e desktop no mesmo nó. */
const HALOS: Record<Fundo, [string, string][]> = {
  entrar: [
    ["-top-10 -left-[60px] h-[300px] w-[300px] md:-top-[180px] md:-left-[120px] md:h-[620px] md:w-[620px]", halo(INDIGO, 0.18)],
    ["top-[280px] -right-20 h-[280px] w-[280px] md:top-auto md:-bottom-[220px] md:-right-[140px] md:h-[640px] md:w-[640px]", halo(TEAL, 0.13)],
    ["-bottom-10 -left-10 h-[260px] w-[260px] md:bottom-auto md:left-auto md:top-[180px] md:right-[180px] md:h-[420px] md:w-[420px]", halo(AMBAR, 0.11)],
  ],
  criar: [
    ["-top-[50px] -left-[60px] h-[290px] w-[290px] md:-top-[180px] md:-left-[120px] md:h-[620px] md:w-[620px]", halo(INDIGO, 0.15)],
  ],
  erro: [
    ["-top-10 -left-[60px] h-[300px] w-[300px] md:-top-[180px] md:-left-[120px] md:h-[620px] md:w-[620px]", halo(INDIGO, 0.15)],
    ["top-[300px] -right-20 h-[280px] w-[280px] md:top-auto md:-bottom-[220px] md:-right-[140px] md:h-[640px] md:w-[640px]", halo(AMBAR, 0.12)],
  ],
  recuperar: [
    ["-top-10 -right-[60px] h-[290px] w-[290px] md:-top-[180px] md:-right-[120px] md:h-[620px] md:w-[620px]", halo(INDIGO, 0.16)],
    ["bottom-5 -left-[60px] h-[270px] w-[270px] md:-bottom-[220px] md:-left-[140px] md:h-[640px] md:w-[640px]", halo(TEAL, 0.12)],
  ],
};

export function AuthShell({
  fundo,
  topRight,
  children,
}: {
  fundo: Fundo;
  /** Link de troca de fluxo, só no desktop (canto superior direito). */
  topRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className={cn("altura-tela relative overflow-hidden text-tinta", FUNDO_CLASSE[fundo])}>
      {HALOS[fundo].map(([pos, bg], i) => (
        <div key={i} aria-hidden className={cn("absolute rounded-capsula", pos)} style={{ background: bg }} />
      ))}

      {/* Marca no canto — só no desktop. No celular ela é o herói da tela e
          mora dentro do conteúdo. */}
      <Link
        href="/login"
        className="absolute left-10 top-[34px] hidden items-center gap-[11px] rounded-chip md:flex focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte"
      >
        <span
          aria-hidden
          className="flex h-9 w-9 flex-none items-center justify-center rounded-icone bg-indigo text-[20px] font-bold text-papel"
        >
          K
        </span>
        <span className="text-[22px] font-bold tracking-[0.3px] text-indigo">Kango</span>
      </Link>

      {topRight && (
        <p className="absolute right-10 top-10 hidden text-corpo text-tinta-fraca md:block">{topRight}</p>
      )}

      {children}
    </main>
  );
}

/**
 * Cartão de vidro do desktop. No celular ele desaparece: o conteúdo fica
 * direto sobre o papel de parede, como nas telas 01–04.
 */
export function AuthCard({
  largura = 460,
  className,
  children,
}: {
  largura?: 460 | 440;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="altura-tela relative flex flex-col px-margem md:items-center md:justify-center md:px-10">
      {/* Um nó só, com classes responsivas: renderizar duas árvores duplicaria
          os campos do formulário e os id/htmlFor. */}
      <div
        className={cn(
          "flex w-full flex-1 flex-col",
          "md:box-border md:min-h-0 md:flex-none md:gap-[18px] md:rounded-[30px] md:p-[34px]",
          "md:bg-white/90 md:backdrop-blur-[24px] md:backdrop-saturate-[1.8]",
          "md:shadow-[inset_1.5px_1.5px_1px_rgba(255,255,255,.95),inset_-1px_-1px_1px_rgba(255,255,255,.6),0_20px_50px_rgba(20,20,30,.12)]",
          largura === 460 ? "md:max-w-[460px]" : "md:max-w-[440px]",
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}
