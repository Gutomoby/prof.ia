import Image from "next/image";
import { cn } from "@/lib/utils";

type Estado = "acenando" | "confuso" | "folheando o material" | "avatar" | undefined;
type Tom = "indigo" | "neutro";

// Mapeamento de estado para nome do arquivo (sem extensão)
const ESTADO_MAPA: Record<Exclude<Estado, undefined>, string> = {
  acenando: "acenando",
  confuso: "confuso",
  "folheando o material": "folheando",
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
