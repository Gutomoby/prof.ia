/*
  As telas de conta são de tela cheia: cada uma monta o próprio papel de parede,
  marca e cartão via <AuthShell> (components/auth/AuthShell.tsx), porque o
  degradê e os halos mudam de tela para tela — e no erro de senha mudam dentro
  da mesma tela.

  Por isso este layout não desenha nada. O painel escuro que existia aqui saiu:
  ele era do tema antigo e não existe em nenhuma das telas 01–04 / 46–51.
*/
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
