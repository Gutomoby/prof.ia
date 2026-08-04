"use client";

import * as React from "react";
import { Check, Target } from "lucide-react";

import { Capsule } from "@/components/ui/capsule";
import { Gauge, ProgressBar } from "@/components/ui/gauge";
import { InsetList, InsetRow } from "@/components/ui/inset-list";
import { MetricText } from "@/components/ui/metric-text";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/utils";

/*
  Espelho de "Kango identidade visual.dc.html", para comparação lado a lado.

  O documento é replicado: fundo hsl(60 8% 91%), container de 1180px com
  padding 56/48/96 e gap 52, h1 de 44/50, rótulo de seção 13/590/.08em, cartões
  brancos com raio 16–20 e sombra 0 1px 3px rgba(0,0,0,.07). Essa moldura é do
  GUIA, não do produto — as telas do app usam o papel de parede e os tokens
  Kango. Não copie daqui para uma tela.

  O que muda em relação ao guia: onde ele tem uma amostra desenhada com style
  inline, aqui entra o primitivo real de components/ui/. É esse o ponto da
  página — se o primitivo divergir, a divergência fica visível na mesma linha.

  A copy é transcrita do guia, caractere por caractere.
*/

// ── moldura do documento (valores do guia, não do produto) ──────────────────

function Secao({ n, titulo, children }: { n: string; titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-tinta-fraca">
        {n} · {titulo}
      </h2>
      {children}
    </section>
  );
}

/** Cartão branco do guia. `papel` para os da seção 06, que usam o papel. */
function Cartao({
  className,
  papel = false,
  radius = 20,
  children,
}: {
  className?: string;
  papel?: boolean;
  radius?: 14 | 16 | 18 | 20;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn("shadow-[0_1px_3px_rgba(0,0,0,.07)]", papel ? "bg-papel" : "bg-white", className)}
      style={{ borderRadius: radius }}
    >
      {children}
    </div>
  );
}

/** Parágrafo de apoio do guia: 12,5px/1.45 em tinta fraca. */
function Nota({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-[12.5px] leading-[1.45] text-tinta-fraca", className)}>{children}</p>;
}

function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-[12.5px]">{children}</span>;
}

// ── dados ───────────────────────────────────────────────────────────────────

const CORES = [
  ["Papel · fundo", "hsl(60 20% 98%)", "bg-papel border-b border-borda", "Fundo de toda tela. Branco quente, nunca #fff puro."],
  ["Tinta · texto", "hsl(220 13% 9%)", "bg-tinta", "Título, linha de lista, número grande."],
  ["Tinta fraca · apoio", "hsl(218 9% 40%)", "bg-tinta-fraca", "Rótulo, subtítulo, data. 4,6:1 no papel, passa AA."],
  ["Índigo · acento", "hsl(226 57% 38%)", "bg-indigo", "Ação principal, aba ativa, progresso, link."],
  ["Verde · acerto", "hsl(152 60% 26%)", "bg-acerto", "Certo, dominado, sequência viva, ≥70%."],
  ["Vermelho · erro", "hsl(0 72% 40%)", "bg-erro", "Errado, prova no calendário, alerta, <40%."],
  ["Cinza tonal", "hsl(60 10% 94%)", "bg-cinza-tonal border-b border-borda", "Trilho do segmented, chip neutro, ícone de linha inativo."],
  ["Borda · separador", "hsl(60 9% 88%)", "bg-borda", "Separador de 0,5px, trilha vazia, contorno de campo."],
] as const;

const MATERIA = [
  ["indigo-700", "#4338CA"],
  ["teal-700", "#0F766E"],
  ["amber-700", "#B45309"],
  ["rose-700", "#BE123C"],
  ["fuchsia-700", "#A21CAF"],
  ["green-700", "#15803D"],
] as const;

const TIPOGRAFIA = [
  ["34/41 · 700 · +.37px", "text-titulo-grande", "Large title", "Uma por tela, à esquerda. Tracking positivo, à moda SF."],
  ["30/36 · 700 · +.36px", "text-titulo-estado", "Título de estado", "Telas centradas: erro, PDF sem texto, sequência"],
  ["25/31 · 700 · -.2px", "text-enunciado", "Enunciado da questão", "Sempre com text-wrap: pretty"],
  ["22/27 · 700 · -.26px", "text-titulo-cartao", "Título de cartão", "“Continuar de onde parou”, nome do tópico"],
  ["17 · 400/590 · -.43px", "text-linha", "Linha de lista e botão", "590 só quando é a linha ativa"],
  ["15/1.5 · 400", "text-corpo", "Texto corrido e explicação", "Piso de 13px em tela; nada menor"],
  ["13 · 400 · tinta fraca", "text-nota text-tinta-fraca", "Subtítulo de linha, nota de pé", "Sempre hsl(218 9% 40%)"],
  ["12 · 590 · +.05em · alta", "text-rotulo uppercase text-tinta-fraca", "Rótulo de seção", "Margem 22px 32px 8px"],
] as const;

const ESPACAMENTO = [
  ["Margem lateral", "16px", "Cartões e grupos. Rótulo de seção entra 32px, alinhado ao texto da linha."],
  ["Padding de cartão", "16px", "Linha de lista: 0 16px + min-height, nunca padding vertical."],
  ["Altura de linha", "52 · 56 · 60", "52 simples · 56 com campo ou alternativa · 60 com duas linhas de texto."],
  ["Ritmo vertical", "22 · 16 · 12", "22 antes de rótulo de seção · 16 entre blocos · 12 dentro do bloco."],
  ["Topo e rodapé", "60 · 34", "60px sob a status bar; 34px de área segura no fim, sempre com flex:none."],
  ["Alvo de toque", "44px", "Mínimo. Cápsula principal 52 · secundária 46 · item de aba 52."],
] as const;

const TELA_GRANDE = [
  ["Janela", <>Desenhado em <Mono>1440×900</Mono>. Conteúdo central com <Mono>max-width</Mono> por tipo: 520px em formulário de conta, 620 a 720px no onboarding, 760px na conversa, 860px na lição.</>],
  ["Sidebar", <>296px fixos, vidro a .55 com borda de 0,5px. Substitui a barra de abas. Item ativo: fundo índigo a 10%, texto 590 e barra de 3px na borda esquerda.</>],
  ["Painéis", <>Centro com padding <Mono>34px 26px 26px</Mono> e gap 20. Coluna auxiliar de 250 a 400px. O chat entra como painel de 372px à direita, também em vidro.</>],
  ["Modo foco", <>Lição, resultado e diagnóstico não têm sidebar: só a tela e uma saída. Nada compete com a questão.</>],
  ["Tabela", <>Biblioteca e histórico usam cabeçalho de 44px em rótulo 12px caixa alta, linhas de 56px e colunas de largura fixa; a primeira coluna é a única que estica.</>],
  ["Chat", <>Começa fechado. Um botão flutuante de 56px (<Mono>⌘J</Mono>) abre o painel; dentro dele, expandir leva à conversa em tela cheia com histórico à esquerda.</>],
] as const;

const REGRAS = [
  ["Nada de trava paga", "Sem vidas, sem energia, sem moedas e sem loja. Errar não custa nada: o erro é dado para o Kango cobrar de novo. Engajamento vem de sequência, XP e domínio por tópico."],
  ["Só o que ele leu", "Toda resposta do professor cita arquivo e página. Fora do material, ele recusa e oferece caminhos, em vez de responder pelo geral sem avisar."],
  ["Corte de nota", "≥70% verde, <40% vermelho, o resto neutro. Vale em pílula, anel, tabela e trilha. “Dominado” é 70% duas vezes."],
  ["Métrica com referência", "Número sozinho é placar. Sempre ao lado: de quanto subiu, quanto falta, ou a meta com a data da prova."],
  ["Kango é o mascote", "Até a persona 3D existir, o círculo listrado com o estado escrito em mono é placeholder. Ele reage em erro, conquista, espera e vazio, sempre entre aspas e nunca no lugar de uma informação."],
  ["Sem logo ainda", "A marca é a palavra “Kango” em SF Pro 700 índigo, com o “K” em quadrado de raio 12 quando precisa de ícone. Nada de símbolo desenhado até a identidade fechar."],
] as const;

// ── página ──────────────────────────────────────────────────────────────────

export default function DesignSystemPage() {
  const [seg, setSeg] = React.useState("ativa");

  return (
    <main className="min-h-screen bg-[hsl(60_8%_91%)] text-tinta">
      {/* box-content: o guia não tem reset de CSS, então os 1180px são só do
          conteúdo e o padding de 48 fica FORA. Com o border-box do Tailwind o
          container encolhia 96px e a grade de cor caía de 5 para 4 colunas. */}
      <div className="mx-auto box-content flex max-w-[1180px] flex-col gap-[52px] px-12 pb-24 pt-14">
        <header className="flex max-w-[780px] flex-col gap-3">
          <span className="font-mono text-[11px] font-medium uppercase leading-none tracking-[0.12em] text-tinta-fraca">
            Kango · identidade visual v2
          </span>
          <h1 className="text-[44px] font-bold leading-[50px] tracking-[0.37px]">Tokens e regras de uso</h1>
          <p className="text-[16px] leading-[1.6] text-tinta-fraca">
            Duas heranças em um sistema: os <strong className="font-semibold text-tinta">tokens do prof.ia</strong>{" "}
            (tema caderneta, papel quente, tinta fria, índigo de caneta) sobre os{" "}
            <strong className="font-semibold text-tinta">componentes nativos do iOS</strong> (large title, inset
            grouped list, cápsulas, Liquid Glass), com a{" "}
            <strong className="font-semibold text-tinta">tipografia da Apple</strong>: SF Pro no texto e SF Mono nas
            métricas. Sem cores de sistema, o índigo do repositório é o acento da marca.
          </p>
          <p className="text-[16px] leading-[1.6] text-tinta-fraca">
            Esta página é o espelho do guia renderizado com os primitivos de{" "}
            <Mono>components/ui/</Mono>. Onde o guia desenha a amostra com style inline, aqui entra o componente
            real — se divergir, a divergência aparece na mesma linha.
          </p>
        </header>

        <Secao n="01" titulo="Cor base">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(212px,1fr))] gap-3.5">
            {CORES.map(([nome, valor, swatch, uso]) => (
              <Cartao key={nome} radius={16} className="overflow-hidden">
                <div className={cn("h-[84px]", swatch)} />
                <div className="px-3.5 pb-3.5 pt-3">
                  <p className="text-[14px] font-semibold">{nome}</p>
                  <MetricText tone="fraca" className="mt-[3px] block text-[12px]">
                    {valor}
                  </MetricText>
                  <Nota className="mt-1.5">{uso}</Nota>
                </div>
              </Cartao>
            ))}
          </div>
          <p className="max-w-[800px] text-[13.5px] leading-[1.55] text-tinta-fraca">
            Estado é <strong className="font-semibold text-tinta">tonal</strong>, não sólido: fundo de linha
            selecionada usa o acento a 8% (<Mono>hsl(226 57% 38% / .08)</Mono>), painel de acerto ou erro a 10–14%,
            botão secundário a 12%. O texto sobre tonal fica na cor cheia.
          </p>
        </Secao>

        <Secao n="02" titulo="Cor de matéria">
          <p className="max-w-[800px] text-[14px] leading-[1.6] text-tinta-fraca">
            Cada matéria recebe uma cor derivada do id por hash estável (<Mono>lib/professor-color.ts</Mono>). Ela
            aparece sempre como <strong className="font-semibold text-tinta">ponto de 7 a 10px</strong>, no cabeçalho,
            na lista, no calendário e no chat, nunca como fundo de cartão. Seis matizes bem separados para dois pontos
            pequenos não virarem a mesma cor.
          </p>
          <div className="flex flex-wrap gap-3">
            {MATERIA.map(([nome, hex]) => (
              <Cartao key={nome} radius={14} className="flex items-center gap-2.5 py-2.5 pl-3 pr-4">
                <span className="h-3 w-3 rounded-capsula" style={{ background: hex }} />
                <span className="text-[14px] font-semibold">{nome}</span>
                <MetricText tone="fraca" className="text-[12px]">
                  {hex}
                </MetricText>
              </Cartao>
            ))}
          </div>
        </Secao>

        <Secao n="03" titulo="Tipografia, SF Pro">
          <div className="grid gap-4 md:grid-cols-2">
            <Cartao className="px-5 py-[18px]">
              <p className="text-[14px] font-semibold">Família</p>
              <p className="mt-1.5 font-mono text-[12.5px] leading-[1.6] text-tinta-fraca">
                font-family: -apple-system, &apos;SF Pro Text&apos;, &apos;SF Pro Display&apos;, system-ui
              </p>
              <p className="mt-2 text-[13px] leading-[1.55] text-tinta-fraca">
                No iPhone e no Mac isso resolve para SF Pro. Fora da Apple cai em system-ui, que mantém a métrica
                próxima. Sempre com <Mono>-webkit-font-smoothing: antialiased</Mono>, é o que dá a finura do texto da
                Apple.
              </p>
            </Cartao>
            <Cartao className="px-5 py-[18px]">
              <p className="text-[14px] font-semibold">Pesos da Apple</p>
              <div className="mt-2 flex flex-col gap-[5px] text-[15px]">
                <p className="font-normal">400 Regular, texto corrido, valor de campo</p>
                <p className="font-medium">510 Medium, botão secundário, linha ativa leve</p>
                <p className="font-semibold">590 Semibold, cápsula principal, rótulo, aba ativa</p>
                <p className="font-bold">700 Bold, large title e número grande</p>
              </div>
              <p className="mt-2 text-[13px] leading-[1.55] text-tinta-fraca">
                Só esses quatro. 510 e 590 são os pesos reais da SF, 500 e 600 puxam para outra fonte no fallback.
              </p>
            </Cartao>
          </div>

          <Cartao className="overflow-hidden">
            {TIPOGRAFIA.map(([spec, classe, amostra, obs]) => (
              <div key={spec} className="flex items-baseline gap-5 border-b border-borda px-[22px] py-[18px] last:border-b-0">
                <MetricText tone="fraca" className="w-[170px] flex-none text-[11.5px]">
                  {spec}
                </MetricText>
                <span className={cn("flex-1", classe)}>{amostra}</span>
                <span className="w-[200px] flex-none text-[12.5px] text-tinta-fraca">{obs}</span>
              </div>
            ))}
          </Cartao>

          <Cartao className="px-5 py-[18px]">
            <p className="text-[14px] font-semibold">SF Mono, só número</p>
            <p className="mt-1.5 text-[13px] leading-[1.6] text-tinta-fraca">
              Toda métrica em <Mono>ui-monospace, &apos;SF Mono&apos;, Menlo</Mono> com{" "}
              <Mono>font-variant-numeric: tabular-nums</Mono> e <Mono>letter-spacing: -.02em</Mono>:{" "}
              <MetricText weight="bold">68%</MetricText> · <MetricText weight="bold">240/400</MetricText> XP ·{" "}
              <MetricText weight="bold">04/08/2026</MetricText> · <MetricText weight="bold">3/5</MetricText>. As
              colunas alinham e o app fica com registro de caderneta, que é a herança do prof.ia. Palavra nunca entra
              em mono.
            </p>
          </Cartao>
        </Secao>

        <Secao n="04" titulo="Papel de parede e Liquid Glass">
          <div className="grid items-start gap-6 md:grid-cols-[340px_1fr]">
            {/* Réplica literal da ilustração do guia. NÃO usa .papel-de-parede
                nem shadow-vidro: os halos daquela classe são dimensionados para
                página inteira, e o shadow-vidro do tema segue as 81 telas (um
                inset, .07) enquanto o guia desenha dois insets e .08. Aqui vale
                o guia, porque o assunto da seção é a receita dele. */}
            <div
              className="relative h-[238px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,.08)]"
              style={{
                borderRadius: 20,
                background:
                  "linear-gradient(175deg,hsl(60 20% 98%) 0%,hsl(60 14% 96%) 60%,hsl(226 22% 97%) 100%)",
              }}
            >
              <div
                className="absolute -left-[30px] -top-10 h-[200px] w-[200px] rounded-capsula"
                style={{ background: "radial-gradient(circle,rgba(67,56,202,.16),rgba(67,56,202,0) 70%)" }}
              />
              <div
                className="absolute -bottom-[30px] -right-10 h-[190px] w-[190px] rounded-capsula"
                style={{ background: "radial-gradient(circle,rgba(15,118,110,.12),rgba(15,118,110,0) 70%)" }}
              />
              <div
                className="absolute left-[22px] right-[22px] top-16 p-4"
                style={{
                  borderRadius: 26,
                  background: "rgba(255,255,255,.86)",
                  backdropFilter: "blur(20px) saturate(180%)",
                  WebkitBackdropFilter: "blur(20px) saturate(180%)",
                  boxShadow:
                    "inset 1.5px 1.5px 1px rgba(255,255,255,.95),inset -1px -1px 1px rgba(255,255,255,.6),0 10px 30px rgba(20,20,30,.08)",
                }}
              >
                <p className="text-[15px] font-semibold tracking-[-0.24px]">Cartão em vidro</p>
                <p className="mt-1 text-nota text-tinta-fraca">O halo atrás é o que faz o material existir.</p>
              </div>
              <div
                className="absolute bottom-[18px] left-[22px] right-[22px] flex h-14 items-center rounded-capsula px-1.5"
                style={{
                  background: "rgba(255,255,255,.74)",
                  backdropFilter: "blur(24px) saturate(180%)",
                  WebkitBackdropFilter: "blur(24px) saturate(180%)",
                  boxShadow: "inset 1.5px 1.5px 1px rgba(255,255,255,1),0 10px 28px rgba(20,20,30,.12)",
                }}
              >
                <span className="flex-1 text-center text-[11px] font-semibold text-indigo">barra flutuante</span>
              </div>
            </div>
            <div className="flex flex-col gap-3 text-[13.5px] leading-[1.6] text-tinta-fraca">
              <p>
                <strong className="font-semibold text-tinta">Fundo</strong>, degradê de 175° do papel para um tom frio
                no rodapé, mais 2 ou 3 halos radiais em índigo, teal ou âmbar a 11–18% de opacidade, ancorados fora da
                borda. O root da tela leva <Mono>overflow:hidden</Mono>, halo não empurra largura.
              </p>
              <p>
                <strong className="font-semibold text-tinta">Receita do vidro</strong>,{" "}
                <Mono>background: rgba(255,255,255,.86)</Mono> · <Mono>backdrop-filter: blur(20px) saturate(180%)</Mono>{" "}
                · brilho <Mono>inset 1.5px 1.5px 1px rgba(255,255,255,.95)</Mono> · sombra{" "}
                <Mono>0 10px 30px rgba(20,20,30,.08)</Mono>.
              </p>
              <p>
                <strong className="font-semibold text-tinta">Opacidade por função</strong>, .86 cartão com texto
                pequeno · .80 pílula de HUD · .74 barra de abas (blur 24px, flutua sobre conteúdo). Nunca abaixo de
                .74: o texto de 13px perde contraste.
              </p>
              <p>
                <strong className="font-semibold text-tinta">Raios</strong>, 26 cartão e grupo de lista · 22 cartão
                pequeno · 20 alerta · 16 chip interno · 14 bolha de chat curta · 12 ícone de linha · 9999 cápsula,
                pílula e ponto.
              </p>
              <p>
                <strong className="font-semibold text-tinta">Elevação</strong>, três níveis, nada além: hairline (só{" "}
                <Mono>inset 0 0 0 1px hsl(60 9% 88%)</Mono>), cartão (<Mono>0 10px 30px /.08</Mono>), flutuante (
                <Mono>0 10px 28px /.12</Mono>). Botão índigo ganha sombra da própria cor a 30%.
              </p>
            </div>
          </div>
        </Secao>

        <Secao n="05" titulo="Espaçamento">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(238px,1fr))] gap-3.5">
            {ESPACAMENTO.map(([titulo, valor, nota]) => (
              <Cartao key={titulo} radius={18} className="px-[18px] py-4">
                <p className="text-[14px] font-semibold">{titulo}</p>
                <MetricText weight="bold" className="mt-1 block text-[20px]">
                  {valor}
                </MetricText>
                <Nota className="mt-1">{nota}</Nota>
              </Cartao>
            ))}
          </div>
        </Secao>

        <Secao n="06" titulo="Componentes">
          <div className="grid gap-4 md:grid-cols-2">
            <Cartao papel className="flex flex-col gap-3 p-5">
              <p className="text-[14px] font-semibold">Cápsulas</p>
              <Capsule block>Ação principal · 52px</Capsule>
              <Capsule variant="secundaria" block>
                Secundária branca · 46px
              </Capsule>
              <Capsule variant="tonal" block>
                Tonal · 44px
              </Capsule>
              <Nota>Uma principal por tela. Texto simples em índigo é a terceira opção, para ação de saída.</Nota>
            </Cartao>

            <Cartao papel className="flex flex-col gap-3 p-5">
              <p className="text-[14px] font-semibold">Inset grouped list</p>
              <InsetList superficie="solido">
                <InsetRow icon={<Check strokeWidth={3} />} iconTone="acerto" title="Linha comum" value="88%" />
                <InsetRow icon={<Target />} iconTone="indigo" title="Linha ativa" value="42%" active />
              </InsetList>
              <Nota>
                Ícone 30px raio 12 · separador 0,5px começando em 58px (ou 16px sem ícone) · sem separador na última
                linha.
              </Nota>
            </Cartao>

            <Cartao papel className="flex flex-col gap-3 p-5">
              <p className="text-[14px] font-semibold">Segmented e pílulas</p>
              <Segmented
                aria-label="Amostra"
                value={seg}
                onValueChange={setSeg}
                options={[
                  { value: "ativa", label: "Ativa" },
                  { value: "inativa1", label: "Inativa" },
                  { value: "inativa2", label: "Inativa" },
                ]}
              />
              <div className="flex gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-capsula bg-indigo/10 px-3 py-1.5 text-nota font-semibold text-indigo">
                  <span className="h-[7px] w-[7px] rounded-capsula bg-indigo-700" />
                  matéria
                </span>
                <span className="rounded-capsula bg-acerto/12 px-3 py-1.5 text-nota font-semibold text-acerto">
                  dominado
                </span>
                <span className="rounded-capsula bg-erro/12 px-3 py-1.5 text-nota font-semibold text-erro">
                  prioridade
                </span>
              </div>
              <Nota>Nota em pílula segue o corte do repo: ≥70% verde, &lt;40% vermelho, resto neutro.</Nota>
            </Cartao>

            <Cartao papel className="flex flex-col gap-3 p-5">
              <p className="text-[14px] font-semibold">Gauge e progresso</p>
              <div className="flex items-center gap-[18px]">
                <Gauge value={68} size="guia" />
                <div className="flex flex-1 flex-col gap-2.5">
                  <ProgressBar value={60} aria-label="Domínio" />
                  <ProgressBar value={50} tone="acerto" espessura="meta" aria-label="Meta" />
                </div>
              </div>
              <Nota>
                Anel: conic-gradient com miolo do papel. Barra: 8px na lição, 6px em meta. Índigo mede domínio; verde
                mede meta cumprida.
              </Nota>
            </Cartao>

            <Cartao papel className="flex flex-col gap-3 p-5">
              <p className="text-[14px] font-semibold">Estado de resposta</p>
              <div className="flex min-h-linha-campo items-center gap-3 rounded-chip bg-acerto/10 px-4">
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-capsula bg-acerto text-[12px] font-semibold text-white">
                  B
                </span>
                <span className="flex-1 text-linha font-semibold">Certa</span>
              </div>
              <div className="flex min-h-linha-campo items-center gap-3 rounded-chip bg-erro/10 px-4">
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-capsula bg-erro text-[12px] font-semibold text-white">
                  C
                </span>
                <span className="flex-1 text-linha font-semibold line-through decoration-[hsl(0_72%_40%/.5)]">
                  Errada
                </span>
              </div>
              <Nota>
                Letra em círculo cheio + fundo tonal. Errada leva risco; nenhuma perde vida ou moeda, não existem.
              </Nota>
            </Cartao>

            <Cartao papel className="flex flex-col gap-3 p-5">
              <p className="text-[14px] font-semibold">Kango</p>
              <div className="flex items-center gap-3.5">
                <span
                  aria-hidden
                  className="flex h-16 w-16 flex-none items-center justify-center rounded-capsula text-center shadow-[inset_0_0_0_1px_rgba(255,255,255,.9)]"
                  style={{
                    background:
                      "repeating-linear-gradient(135deg, rgba(67,56,202,.2) 0 7px, rgba(255,255,255,.8) 7px 14px)",
                  }}
                >
                  <span className="font-mono text-[8px] font-medium leading-[1.25] text-tinta-fraca">
                    KANGO 3D
                    <br />
                    estado
                  </span>
                </span>
                <Nota className="flex-1 leading-[1.5]">
                  Até a persona existir: círculo listrado a 135° na cor do contexto, com o estado escrito em mono.
                  Tamanhos: 44 em linha, 60–64 em cartão, 104–132 em tela centrada. A fala do Kango vem entre aspas,
                  em 13–14px.
                </Nota>
              </div>
            </Cartao>
          </div>
        </Secao>

        <Secao n="07" titulo="Ícones, movimento e escrita">
          <div className="grid gap-4 md:grid-cols-3">
            <Cartao className="px-5 py-[18px]">
              <p className="text-[14px] font-semibold">Ícones</p>
              <p className="mt-1.5 text-[13px] leading-[1.55] text-tinta-fraca">
                Lucide, traço 2 (3 no check dentro de círculo). Tamanhos: 22 na aba · 19 no cabeçalho · 17 na linha ·
                14 no rótulo. Ícone de linha vive num quadrado de 30px com raio 12: cheio na cor de estado, cinza
                tonal quando inativo.
              </p>
            </Cartao>
            <Cartao className="px-5 py-[18px]">
              <p className="text-[14px] font-semibold">Movimento</p>
              <p className="mt-1.5 text-[13px] leading-[1.55] text-tinta-fraca">
                Curto e nativo: 0,25s ease-out em troca de tela, 0,2s no toque (escala 0,98), 0,4s no anel e na barra
                de progresso. Resposta do chat aparece token a token com o cursor em bloco índigo. Nada de bounce nem
                confete.
              </p>
            </Cartao>
            <Cartao className="px-5 py-[18px]">
              <p className="text-[14px] font-semibold">Escrita</p>
              <p className="mt-1.5 text-[13px] leading-[1.55] text-tinta-fraca">
                Segunda pessoa, verbo no começo, número quando existe: “Você acerta 42% aqui”, “Falta 1 lição pra
                fechar o dia”. O Kango fala como colega, não como robô, e nunca promete o que a IA não leu no
                material.
              </p>
            </Cartao>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-alerta bg-acerto/8 px-5 py-[18px] shadow-[inset_0_0_0_1px_hsl(152_60%_26%/.18)]">
              <p className="text-[14px] font-semibold text-acerto">Faça</p>
              <p className="mt-2 text-[13px] leading-[1.7] text-[hsl(220_13%_20%)]">
                Um só objetivo por tela · métrica sempre em mono tabular · cor de matéria só como ponto · vidro sobre
                halo, nunca sobre branco chapado · rodapé com flex:none · piso de 13px no texto e 44px no toque.
              </p>
            </div>
            <div className="rounded-alerta bg-erro/8 px-5 py-[18px] shadow-[inset_0_0_0_1px_hsl(0_72%_40%/.18)]">
              <p className="text-[14px] font-semibold text-erro">Não faça</p>
              <p className="mt-2 text-[13px] leading-[1.7] text-[hsl(220_13%_20%)]">
                Cor de sistema da Apple no lugar do índigo · gradiente colorido em botão · sombra dura de jogo ·
                quatro pesos de fonte na mesma tela · emoji como ícone · vidas, moedas, loja ou qualquer trava paga.
              </p>
            </div>
          </div>
        </Secao>

        <Secao n="08" titulo="Tela grande">
          <p className="max-w-[820px] text-[14px] leading-[1.6] text-tinta-fraca">
            O computador não é o celular esticado, mas também não tem escala própria: os tokens são os mesmos (linha
            de 52 a 56px com texto 17px, cartão de raio 26 com padding 16, cápsula de 52px, vidro a .86). Só o que
            ganha espaço cresce: o anel de domínio (132px), o large title e o enunciado da lição.
          </p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3.5">
            {TELA_GRANDE.map(([titulo, corpo]) => (
              <Cartao key={titulo} className="px-5 py-[18px]">
                <p className="text-[14px] font-semibold">{titulo}</p>
                <p className="mt-1.5 text-[13px] leading-[1.55] text-tinta-fraca">{corpo}</p>
              </Cartao>
            ))}
          </div>
        </Secao>

        <Secao n="09" titulo="Mouse, teclado e espera">
          <div className="grid gap-4 md:grid-cols-2">
            <Cartao className="px-5 py-[18px]">
              <p className="text-[14px] font-semibold">Hover e foco</p>
              <p className="mt-1.5 text-[13px] leading-[1.55] text-tinta-fraca">
                Movimento só onde há navegação, em <Mono>.14s a .18s ease-out</Mono>: cápsula escurece 6% e afunda 1px
                no clique, linha de lista pinta o fundo com índigo a 5%, cartão que abre tela sobe 2px e ganha sombra,
                chip e aba ganham contorno. Número, rótulo e gráfico não reagem. O foco por teclado é sempre um anel
                índigo de 3px, e nunca é removido.
              </p>
            </Cartao>
            <Cartao className="px-5 py-[18px]">
              <p className="text-[14px] font-semibold">Atalhos</p>
              <p className="mt-1.5 text-[13px] leading-[1.55] text-tinta-fraca">
                <Mono>⌘K</Mono> buscar · <Mono>⌘N</Mono> nova matéria · <Mono>⌘J</Mono> chat · <Mono>⌘↵</Mono> gerar
                quiz · <Mono>1 a 4</Mono> escolher alternativa · <Mono>↵</Mono> responder e continuar ·{" "}
                <Mono>Esc</Mono> sair · <Mono>⌘,</Mono> configurações. Na conversa, <Mono>⏎</Mono> envia e{" "}
                <Mono>⇧⏎</Mono> quebra linha.
              </p>
            </Cartao>
            <Cartao className="px-5 py-[18px]">
              <p className="text-[14px] font-semibold">Skeleton</p>
              <p className="mt-1.5 text-[13px] leading-[1.55] text-tinta-fraca">
                Barra em <Mono>hsl(60 10% 94%)</Mono> pulsando de 1 a .45 em 2s. O que já existe no cliente aparece de
                verdade (título, abas, barra de abas); só o que vem da API pulsa, no mesmo tamanho do conteúdo final,
                para a tela não pular.
              </p>
            </Cartao>
            <Cartao className="px-5 py-[18px]">
              <p className="text-[14px] font-semibold">Erro e vazio</p>
              <p className="mt-1.5 text-[13px] leading-[1.55] text-tinta-fraca">
                Ícone em quadrado de 76px com raio 26, título de 30px, uma frase de causa e uma lista de saídas: nunca
                só “algo deu errado”. O código técnico vai em mono 12px no pé. Vazio sempre traz o Kango e um caminho.
              </p>
            </Cartao>
          </div>
        </Secao>

        <Secao n="10" titulo="Regras do produto que o visual carrega">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3.5">
            {REGRAS.map(([titulo, corpo]) => (
              <Cartao key={titulo} className="px-5 py-[18px]">
                <p className="text-[14px] font-semibold">{titulo}</p>
                <p className="mt-1.5 text-[13px] leading-[1.55] text-tinta-fraca">{corpo}</p>
              </Cartao>
            ))}
          </div>
        </Secao>
      </div>
    </main>
  );
}
