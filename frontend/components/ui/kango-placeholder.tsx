import { cn } from "@/lib/utils";

/*
  Kango, placeholder. A persona 3D não existe ainda — até existir, o mascote é
  um círculo listrado a 135° com o estado escrito em mono por cima. Mantenha o
  tamanho e a posição; troque só o conteúdo quando a persona chegar.

  A listra acompanha o diâmetro (medido nas telas): 8px de faixa no de 104,
  7px no de 60–64, 6px no de 38–44. O tom "neutro" é o da tela 03, quando o
  Kango está confuso e a cor de acento sairia de lugar.
*/

type Tom = "indigo" | "neutro";

const COR: Record<Tom, string> = {
  indigo: "rgba(67,56,202,.2)",
  neutro: "rgba(0,0,0,.08)",
};

/** Faixa da listra e corpo do rótulo por faixa de diâmetro. */
function escala(px: number) {
  if (px >= 96) return { faixa: 8, fonte: 9, lh: 1.3 };
  if (px >= 56) return { faixa: 7, fonte: 8, lh: 1.25 };
  return { faixa: 6, fonte: 7, lh: 1.2 };
}

export function KangoPlaceholder({
  estado,
  px = 64,
  tom = "indigo",
  className,
}: {
  /** A segunda linha do rótulo: "acenando", "confuso", "avatar"… */
  estado?: string;
  /** Diâmetro em px — define o tamanho e, junto, a largura da listra. */
  px?: number;
  tom?: Tom;
  className?: string;
}) {
  const { faixa, fonte, lh } = escala(px);

  return (
    <span
      aria-hidden
      className={cn(
        "flex flex-none items-center justify-center rounded-capsula text-center",
        "shadow-[inset_0_0_0_1px_rgba(255,255,255,.9)]",
        className
      )}
      style={{
        width: px,
        height: px,
        background: `repeating-linear-gradient(135deg, ${COR[tom]} 0 ${faixa}px, rgba(255,255,255,.8) ${faixa}px ${faixa * 2}px)`,
      }}
    >
      <span
        className="font-mono font-medium text-tinta-fraca"
        style={{ fontSize: fonte, lineHeight: lh }}
      >
        KANGO 3D
        {estado && (
          <>
            <br />
            {estado}
          </>
        )}
      </span>
    </span>
  );
}
