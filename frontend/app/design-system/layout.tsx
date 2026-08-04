import { notFound } from "next/navigation";

// /design-system é ferramenta de trabalho, não tela de produto: espelha o guia
// de identidade para conferir os primitivos lado a lado. Em produção ela não
// existe — quem digitar a URL recebe 404, e o Next nem chega a pré-renderizar a
// página no build.
//
// Continua acessível em dev e em deploys de preview, que é onde ela serve.
//
// VERCEL_ENV é a fonte da verdade na Vercel ("production" | "preview" |
// "development"); NODE_ENV entra só como rede de segurança para build fora da
// Vercel, onde VERCEL_ENV não existe e um `next build` é sempre production.
const ehProducao =
  process.env.VERCEL_ENV === "production" ||
  (!process.env.VERCEL_ENV && process.env.NODE_ENV === "production");

export default function DesignSystemLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (ehProducao) notFound();

  return <>{children}</>;
}
