import type { Config } from "tailwindcss";
import colors from "tailwindcss/colors";

// Configuração do Tailwind compatível com shadcn/ui (variáveis CSS via HSL)
const config: Config = {
  // "class", e nada no app põe a classe: as variantes dark: que sobraram em
  // componentes shadcn ficam inertes. Era "media", e com isso metade do app
  // escurecia sozinha num design que só tem telas claras.
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        // Cor de ação/gamificação (âmbar do Kango): CTAs de estudo, streak,
        // medalhas. Sempre com action-foreground (texto escuro) por contraste.
        action: {
          DEFAULT: "hsl(var(--action))",
          foreground: "hsl(var(--action-foreground))",
        },

        // ── Kango, nomes semânticos do handoff ──────────────────────────
        // Todos com <alpha-value> porque o sistema é tonal: bg-indigo/8 na
        // linha selecionada, bg-acerto/10 no painel de acerto, bg-indigo/12
        // na cápsula tonal. O texto sobre tonal fica na cor cheia.
        papel: "hsl(var(--papel) / <alpha-value>)",
        tinta: {
          DEFAULT: "hsl(var(--tinta) / <alpha-value>)",
          fraca: "hsl(var(--tinta-fraca) / <alpha-value>)",
        },
        // Espalha a escala nativa antes do DEFAULT: `indigo` sozinho é o
        // acento Kango, e os degraus numéricos continuam existindo porque
        // lib/professor-color.ts depende de bg-indigo-700.
        indigo: { ...colors.indigo, DEFAULT: "hsl(var(--indigo) / <alpha-value>)" },
        acerto: "hsl(var(--acerto) / <alpha-value>)",
        erro: "hsl(var(--erro) / <alpha-value>)",
        "cinza-tonal": "hsl(var(--cinza-tonal) / <alpha-value>)",
        borda: {
          DEFAULT: "hsl(var(--borda) / <alpha-value>)",
          forte: "hsl(var(--borda-forte) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
      // Os quatro pesos reais da SF. 500 e 600 NÃO existem na família e caem
      // em outra fonte no fallback, então os apelidos padrão do Tailwind
      // (font-medium/font-semibold) apontam para 510/590.
      fontWeight: {
        normal: "400",
        medium: "510",
        semibold: "590",
        bold: "700",
      },
      // Escala tipográfica do handoff. Peso e tracking viajam junto com o
      // tamanho para não existir "17px sem o -.43px" espalhado pelas telas.
      fontSize: {
        "titulo-grande": ["34px", { lineHeight: "41px", letterSpacing: "0.37px", fontWeight: "700" }],
        "titulo-estado": ["30px", { lineHeight: "36px", letterSpacing: "0.36px", fontWeight: "700" }],
        enunciado: ["25px", { lineHeight: "31px", letterSpacing: "-0.2px", fontWeight: "700" }],
        // Só o enunciado cresce no desktop; o resto dos tokens é o mesmo.
        "enunciado-lg": ["34px", { lineHeight: "41px", letterSpacing: "-0.2px", fontWeight: "700" }],
        "titulo-cartao": ["22px", { lineHeight: "27px", letterSpacing: "-0.26px", fontWeight: "700" }],
        // Vazio dentro de uma tela que já tem large title (telas 18 e 12): fica
        // entre o título de estado (30, tela inteira centrada) e o de cartão.
        "titulo-vazio": ["24px", { lineHeight: "30px", letterSpacing: "0.2px", fontWeight: "700" }],
        // Sem line-height: a altura de linha de lista vem do min-height.
        linha: ["17px", { letterSpacing: "-0.43px" }],
        corpo: ["15px", { lineHeight: "1.5" }],
        // Piso do sistema: 13px em tela, nada menor.
        nota: "13px",
        rotulo: ["12px", { letterSpacing: "0.05em", fontWeight: "590" }],
      },
      borderRadius: {
        xl: "var(--radius)",
        lg: "calc(var(--radius) - 2px)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 6px)",
        // Kango
        grupo: "26px", // cartão e grupo de lista
        cartao: "22px", // cartão pequeno
        alerta: "20px",
        chip: "16px",
        bolha: "14px", // bolha curta de chat
        icone: "12px", // quadrado de 30px do ícone de linha
        capsula: "9999px",
      },
      // Degraus tonais que o sistema usa e o Tailwind não traz de fábrica.
      opacity: {
        6: "0.06",
        8: "0.08",
        12: "0.12",
        14: "0.14",
        18: "0.18",
        55: "0.55",
        74: "0.74",
        86: "0.86",
      },
      spacing: {
        // Alturas de linha de lista: simples / com campo ou alternativa /
        // com duas linhas de texto.
        linha: "52px",
        "linha-campo": "56px",
        "linha-dupla": "60px",
        toque: "44px", // alvo mínimo
        "capsula-principal": "52px",
        "capsula-secundaria": "46px",
        "capsula-tonal": "44px",
        margem: "16px",
        "rotulo-secao": "32px", // 16 da margem + 16 do padding do grupo
        "topo-seguro": "60px", // sob a status bar
        "rodape-seguro": "34px",
        sidebar: "296px",
      },
      // Elevação, três níveis e nada além.
      boxShadow: {
        hairline: "inset 0 0 0 1px hsl(var(--borda))",
        cartao: "0 10px 30px rgba(20, 20, 30, .08)",
        "cartao-hover": "0 16px 40px rgba(20, 20, 30, .13)",
        flutuante: "0 10px 28px rgba(20, 20, 30, .12)",
        // Vidro = brilho interno + sombra de cartão.
        // O guia mostra DOIS insets e .08 na sombra; as 81 telas usam UM inset
        // e .07, 177 vezes contra 6. Vale o das telas.
        vidro: "inset 1.5px 1.5px 1px rgba(255, 255, 255, .95), 0 10px 30px rgba(20, 20, 30, .07)",
        "vidro-flutuante":
          "inset 1.5px 1.5px 1px rgba(255, 255, 255, 1), 0 10px 28px rgba(20, 20, 30, .12)",
        // Botão índigo ganha sombra da própria cor a 30%.
        capsula: "0 8px 20px hsl(var(--indigo) / .3)",
        "capsula-hover": "0 12px 26px hsl(var(--indigo) / .34)",
        "capsula-secundaria":
          "inset 0 0 0 1px hsl(var(--borda)), 0 6px 18px rgba(20, 20, 30, .10)",
        segmentada: "0 1px 3px rgba(0, 0, 0, .1)",
        // Foco por teclado: anel índigo de 3px, nunca removido.
        foco: "0 0 0 3px hsl(var(--indigo) / .18)",
        "foco-forte": "0 0 0 3px hsl(var(--indigo) / .3)",
      },
      // Movimento curto e nativo: .14–.18s hover, .2s toque, .25s troca de
      // tela, .4s anel e barra de progresso.
      transitionDuration: {
        140: "140ms",
        180: "180ms",
        250: "250ms",
        400: "400ms",
      },
      keyframes: {
        // Painel de resposta da lição: sobe do rodapé. .25s ease-out é a
        // duração de troca de tela do guia §07 — curto e nativo, sem bounce.
        "subir-rodape": {
          from: { transform: "translateY(100%)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        // Barra indeterminada: uma faixa atravessa o trilho. Diz "trabalhando"
        // sem afirmar quanto falta — a geração é uma requisição só e ninguém
        // sabe em que ponto está.
        indeterminada: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(400%)" },
        },
        // Brilho que percorre a linha, para a lista de passos não parecer
        // congelada durante os ~10s de espera.
        brilho: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "subir-rodape": "subir-rodape 0.25s ease-out",
        indeterminada: "indeterminada 1.4s ease-in-out infinite",
        brilho: "brilho 1.8s ease-in-out infinite",
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
