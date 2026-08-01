import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// next/font faz self-host do arquivo da fonte no build — sem request externo em runtime.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

// Só para números (classe .metric). Texto corrido continua em Inter — a mono
// existe para as métricas alinharem em coluna e o app ter cara de caderneta.
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-mono",
});

// Metadados que aparecem na aba do navegador e em compartilhamentos
export const metadata: Metadata = {
  title: "ProfessorIA",
  description: "Seu professor virtual de qualquer matéria, com base no seu próprio material.",
};

// Informa ao navegador que o app tem os dois temas, para que controles nativos
// (barras de rolagem, campos de formulário) acompanhem.
export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbf9" },
    { media: "(prefers-color-scheme: dark)", color: "#121317" },
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
    <html lang="pt-BR" suppressHydrationWarning className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
