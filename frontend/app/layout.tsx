import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// next/font faz self-host do arquivo da fonte no build — sem request externo em runtime.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

// Metadados que aparecem na aba do navegador e em compartilhamentos
export const metadata: Metadata = {
  title: "ProfessorIA",
  description: "Seu professor virtual de qualquer matéria, com base no seu próprio material.",
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
    <html lang="pt-BR" suppressHydrationWarning className={inter.variable}>
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
