import Image from "next/image";
import { cn } from "@/lib/utils";

type Estado = "acenando" | "confuso" | "folheando o material" | "avatar" | undefined;
type Tom = "indigo" | "neutro";

// Mapeamento de estado para nome do arquivo (sem extensão).
//
// "acenando" (waving) ainda não tem pose própria no lote novo (2026-09-07) —
// usa "com-livro" como substituto temporário até alguém gerar a pose real de
// aceno. "folheando o material" foi remapeado pra "lendo", que já é
// exatamente essa cena (sentado lendo) no estilo novo, então não é stopgap.
const ESTADO_MAPA: Record<Exclude<Estado, undefined>, string> = {
  acenando: "com-livro",
  confuso: "confuso",
  "folheando o material": "lendo",
  avatar: "avatar",
};

export function Kango({
  estado,
  px = 64,
  tom = "indigo",
  className,
}: {
  /** A expressão: "acenando", "confuso", "folheando o material", "avatar" */
  estado?: Estado;
  /** Diâmetro em px */
  px?: number;
  tom?: Tom;
  className?: string;
}) {
  // Padrão para quando não há estado
  const arquivoEstado = estado && estado in ESTADO_MAPA ? ESTADO_MAPA[estado as Exclude<Estado, undefined>] : "acenando";

  // Efeito CSS para tom neutro (grayscale)
  const filtro = tom === "neutro" ? "grayscale(1)" : "none";

  return (
    <span
      className={cn("flex flex-none items-center justify-center rounded-capsula overflow-hidden", className)}
      style={{
        width: px,
        height: px,
      }}
    >
      <Image
        src={`/kango/${arquivoEstado}.png`}
        alt={estado || "Kango"}
        width={px}
        height={px}
        priority
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: filtro,
        }}
      />
    </span>
  );
}
