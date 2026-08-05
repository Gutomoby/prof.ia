"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Download, Share2 } from "lucide-react";
import { Capsule } from "@/components/ui/capsule";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/*
  Tela 36 · Compartilhar progresso.

  A prévia da folha É o canvas que vira a imagem — não uma versão em HTML do
  mesmo cartão. Duas implementações do mesmo desenho divergem no primeiro
  ajuste, e aqui a divergência seria justamente entre o que a pessoa vê e o
  que ela publica.

  O chip "Conquistas" do desenho ficou de fora: conquistas não existem no
  backend (nem tabela, nem rota, nem tipo — é a Fase G, e o mesmo motivo pelo
  qual a tela 33 não as mostra). Chip que não acrescenta nada à imagem seria
  um controle morto.

  "Salvar nas Fotos" virou "Salvar imagem": no navegador o arquivo vai para os
  downloads, e no iPhone é de lá que a pessoa salva nas Fotos. Prometer o
  álbum seria prometer o que o app não faz.
*/

const CARTAO = {
  largura: 360,
  raio: 26,
  padding: 20,
  avatar: 56,
  gapTiles: 10,
  // 3x — a imagem sai com 1080 de largura, tamanho de post, e a prévia na
  // tela fica nítida em qualquer densidade.
  escala: 3,
};

const SANS = "-apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif";
const MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace";

export interface DadosCompartilhar {
  nome: string;
  materia: string | null;
  nivel: number;
  sequencia: number;
  dominioPct: number | null;
  topicos: number | null;
}

interface Marcados {
  sequencia: boolean;
  dominio: boolean;
  materia: boolean;
}

function caminhoArredondado(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Kango placeholder: o mesmo listrado a 135° do resto do app, em canvas. */
function desenhaKango(ctx: CanvasRenderingContext2D, cx: number, cy: number, d: number) {
  const r = d / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  ctx.translate(cx, cy);
  ctx.rotate((-45 * Math.PI) / 180);
  const faixa = 7;
  for (let i = -r * 2; i < r * 2; i += faixa * 2) {
    ctx.fillStyle = "rgba(255,255,255,.30)";
    ctx.fillRect(i, -r * 2, faixa, r * 4);
    ctx.fillStyle = "rgba(255,255,255,.14)";
    ctx.fillRect(i + faixa, -r * 2, faixa, r * 4);
  }
  ctx.restore();

  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,.92)";
  ctx.font = `510 7.5px ${MONO}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("KANGO 3D", cx, cy - 5);
  ctx.fillText("comemora", cx, cy + 4.5);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 0.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

interface Tile {
  valor: string;
  rotulo: string;
}

/** Os quadradinhos do cartão saem dos chips marcados, nesta ordem. */
function tilesDe(dados: DadosCompartilhar, marcados: Marcados): Tile[] {
  const tiles: Tile[] = [];
  if (marcados.sequencia) {
    tiles.push({
      valor: String(dados.sequencia),
      rotulo: dados.sequencia === 1 ? "dia seguido" : "dias seguidos",
    });
  }
  if (marcados.dominio) {
    if (dados.dominioPct !== null) {
      tiles.push({ valor: `${Math.round(dados.dominioPct)}%`, rotulo: "de domínio" });
    }
    if (dados.topicos !== null) {
      tiles.push({
        valor: String(dados.topicos),
        rotulo: dados.topicos === 1 ? "tópico" : "tópicos",
      });
    }
  }
  return tiles;
}

const ALTURA_TILE = 60;

/** Altura em px lógicos — precisa ser sabida antes de dimensionar o canvas. */
function alturaDe(tiles: Tile[]) {
  const { padding: P, avatar: A } = CARTAO;
  return P + A + (tiles.length > 0 ? 16 + ALTURA_TILE : 0) + 16 + 16 + P;
}

/** Corta o texto com reticências quando ele não cabe na largura disponível. */
function cabe(ctx: CanvasRenderingContext2D, texto: string, max: number) {
  if (ctx.measureText(texto).width <= max) return texto;
  let corte = texto;
  while (corte.length > 1 && ctx.measureText(`${corte}…`).width > max) {
    corte = corte.slice(0, -1);
  }
  return `${corte}…`;
}

function desenhaCartao(
  ctx: CanvasRenderingContext2D,
  dados: DadosCompartilhar,
  marcados: Marcados
) {
  const { largura: L, padding: P, avatar: A, raio, gapTiles } = CARTAO;

  const tiles = tilesDe(dados, marcados);
  const alturaTiles = tiles.length > 0 ? ALTURA_TILE : 0;
  const altura = alturaDe(tiles);

  // Fundo: degradê de 160°, do índigo do app para o mesmo tom mais fundo.
  const grad = ctx.createLinearGradient(0, 0, L * 0.35, altura);
  grad.addColorStop(0, "hsl(226, 57%, 38%)");
  grad.addColorStop(1, "hsl(226, 50%, 30%)");
  caminhoArredondado(ctx, 0, 0, L, altura, raio);
  ctx.fillStyle = grad;
  ctx.fill();

  desenhaKango(ctx, P + A / 2, P + A / 2, A);

  const xTexto = P + A + 14;
  const larguraTexto = L - P - xTexto;
  ctx.fillStyle = "hsl(60, 20%, 98%)";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = `700 19px ${SANS}`;
  ctx.fillText(cabe(ctx, dados.nome, larguraTexto), xTexto, P + 24);

  // Nível sempre; matéria só quando marcada. O número vai em mono, o resto
  // não — palavra nunca entra em mono, nem desenhada em canvas.
  ctx.globalAlpha = 0.85;
  ctx.font = `400 13px ${SANS}`;
  const materia = marcados.materia && dados.materia ? `${dados.materia} · ` : "";
  const nivel = String(dados.nivel);
  ctx.font = `400 13px ${MONO}`;
  const larguraNivel = ctx.measureText(nivel).width;
  ctx.font = `400 13px ${SANS}`;
  const prefixo = cabe(ctx, `${materia}Nível `, larguraTexto - larguraNivel);
  const larguraPrefixo = ctx.measureText(prefixo).width;
  ctx.fillText(prefixo, xTexto, P + 42);
  ctx.font = `400 13px ${MONO}`;
  ctx.fillText(nivel, xTexto + larguraPrefixo, P + 42);
  ctx.globalAlpha = 1;

  if (tiles.length > 0) {
    const yTiles = P + A + 16;
    const larguraTile = (L - P * 2 - gapTiles * (tiles.length - 1)) / tiles.length;
    tiles.forEach((tile, i) => {
      const x = P + i * (larguraTile + gapTiles);
      caminhoArredondado(ctx, x, yTiles, larguraTile, alturaTiles, 18);
      ctx.fillStyle = "rgba(255,255,255,.16)";
      ctx.fill();

      ctx.fillStyle = "hsl(60, 20%, 98%)";
      ctx.textAlign = "center";
      ctx.font = `700 22px ${MONO}`;
      ctx.fillText(tile.valor, x + larguraTile / 2, yTiles + 34);
      ctx.globalAlpha = 0.85;
      ctx.font = `400 11.5px ${SANS}`;
      ctx.fillText(tile.rotulo, x + larguraTile / 2, yTiles + 50);
      ctx.globalAlpha = 1;
    });
  }

  ctx.textAlign = "left";
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = "hsl(60, 20%, 98%)";
  ctx.font = `590 13px ${SANS}`;
  ctx.fillText("KANGO · estudei com o meu próprio material", P, altura - P - 2);
  ctx.globalAlpha = 1;

  return altura;
}

function ChipMarcado({
  marcado,
  onClick,
  children,
}: {
  marcado: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={marcado}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-capsula px-[13px] py-2 text-[14px] font-semibold",
        "transition-colors duration-140 ease-out",
        "focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte",
        marcado ? "bg-indigo text-papel" : "bg-cinza-tonal text-tinta-fraca hover:bg-borda"
      )}
    >
      {marcado && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      {children}
    </button>
  );
}

export function CompartilharProgresso({
  aberta,
  onFechar,
  dados,
}: {
  aberta: boolean;
  onFechar: () => void;
  dados: DadosCompartilhar;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [marcados, setMarcados] = useState<Marcados>({
    sequencia: true,
    dominio: true,
    materia: false,
  });
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!aberta || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { escala, largura } = CARTAO;
    // A altura muda com quantos tiles estão marcados, então ela é calculada
    // antes: mexer em canvas.width limpa o contexto inteiro, inclusive a
    // transformação.
    canvas.width = largura * escala;
    canvas.height = alturaDe(tilesDe(dados, marcados)) * escala;
    ctx.scale(escala, escala);
    desenhaCartao(ctx, dados, marcados);
  }, [aberta, dados, marcados]);

  const gerarArquivo = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
    if (!blob) return null;
    return new File([blob], "kango-progresso.png", { type: "image/png" });
  }, []);

  function baixar(arquivo: File) {
    const url = URL.createObjectURL(arquivo);
    const a = document.createElement("a");
    a.href = url;
    a.download = arquivo.name;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function compartilhar() {
    setAviso(null);
    const arquivo = await gerarArquivo();
    if (!arquivo) return;

    // navigator.share com arquivo é do celular; no desktop a maioria dos
    // navegadores não aceita e o caminho honesto é baixar a imagem.
    if (navigator.canShare?.({ files: [arquivo] })) {
      try {
        await navigator.share({ files: [arquivo], title: "Meu progresso no Kango" });
        return;
      } catch (err) {
        // Cancelar o menu de compartilhar não é erro — não vira aviso.
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }

    baixar(arquivo);
    setAviso("Seu navegador não abre o menu de compartilhar, então a imagem foi baixada.");
  }

  async function salvar() {
    setAviso(null);
    const arquivo = await gerarArquivo();
    if (arquivo) baixar(arquivo);
  }

  return (
    <Sheet aberta={aberta} onFechar={onFechar} titulo="Compartilhar progresso">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-titulo-cartao text-tinta">Compartilhar</p>
        <button
          type="button"
          onClick={onFechar}
          className="rounded-chip px-2 py-1 text-linha font-medium text-indigo hover:bg-indigo/6 focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte"
        >
          Cancelar
        </button>
      </div>

      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`Cartão de progresso de ${dados.nome}, nível ${dados.nivel}`}
        className="mt-3.5 w-full rounded-grupo shadow-[0_12px_30px_hsl(var(--indigo)/0.3)]"
      />

      <p className="mb-2 mt-[18px] px-4 text-rotulo uppercase text-tinta-fraca">O que aparece</p>
      <div className="flex flex-wrap gap-2 px-0.5">
        <ChipMarcado
          marcado={marcados.sequencia}
          onClick={() => setMarcados((m) => ({ ...m, sequencia: !m.sequencia }))}
        >
          Sequência
        </ChipMarcado>
        <ChipMarcado
          marcado={marcados.dominio}
          onClick={() => setMarcados((m) => ({ ...m, dominio: !m.dominio }))}
        >
          Domínio
        </ChipMarcado>
        <ChipMarcado
          marcado={marcados.materia}
          onClick={() => setMarcados((m) => ({ ...m, materia: !m.materia }))}
        >
          Matéria
        </ChipMarcado>
      </div>

      <div className="mt-4">
        <Capsule block onClick={compartilhar}>
          <Share2 className="h-[18px] w-[18px]" />
          Compartilhar imagem
        </Capsule>
        <Capsule variant="secundaria" block className="mt-2.5" onClick={salvar}>
          <Download className="h-[17px] w-[17px]" />
          Salvar imagem
        </Capsule>
      </div>

      {aviso && <p className="mt-3 px-4 text-center text-nota text-tinta-fraca">{aviso}</p>}

      <p className="mt-3 px-4 text-center text-[12.5px] leading-[1.45] text-tinta-fraca">
        Só o que está marcado acima sai na imagem. Nenhum dado do seu material é compartilhado.
      </p>
    </Sheet>
  );
}
