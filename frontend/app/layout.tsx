import type { Metadata } from "next";
import "./globals.css";
// KaTeX: as fórmulas que a IA escreve são renderizadas em components/ui/
// math-text.tsx. O CSS é global porque a marcação sai do KaTeX em qualquer
// tela que mostre enunciado, alternativa ou explicação.
import "katex/dist/katex.min.css";

// Sem next/font: a identidade Kango pede SF Pro no texto e SF Mono nas
// métricas, e as duas vêm do sistema via -apple-system / ui-monospace. Não há
// arquivo para baixar nem para self-hostar, então a pilha inteira mora em
// --font-sans / --font-mono em globals.css. Fora da Apple, system-ui assume e
// mantém a métrica próxima.

// Metadados que aparecem na aba do navegador e em compartilhamentos
export const metadata: Metadata = {
  title: "Kango",
  description:
    "Kango, o seu companheiro de estudos: quizzes, trilhas e progresso a partir do seu próprio material.",
};

// Informa ao navegador que o app tem os dois temas, para que controles nativos
// (barras de rolagem, campos de formulário) acompanhem.
// Hexes = --background dos dois temas em globals.css.
export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1326" },
  ],
};

// Layout raiz: envolve TODAS as rotas (públicas e autenticadas).
// Não coloque sidebar/nav aqui — esses ficam em (app)/layout.tsx,
// para que a tela de login não os herde.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      {/* antialiased é obrigatório, não estético: é o -webkit-font-smoothing
          que dá a finura do texto da Apple. Sem ele a SF engorda. */}
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
