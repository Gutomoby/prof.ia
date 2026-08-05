/*
  Casca do primeiro acesso (telas 05 a 11).

  Mora fora de (app) pelo mesmo motivo da lição: nas telas de onboarding não
  existe barra de abas nem sidebar — a pessoa ainda não tem para onde navegar,
  e a única saída de cada tela é o próprio fluxo. Esconder a casca de dentro de
  (app) daria o mesmo resultado com condicional espalhada por três arquivos.

  O papel de parede é o do app. Cada tela do handoff tem seu próprio degradê
  (05 índigo, 07 teal, 09 índigo…), mas os halos são a mesma família e o
  ganho de trocar o fundo a cada passo não paga três classes novas em
  globals.css — o fluxo inteiro dura menos de dois minutos.

  620px é a largura de onboarding do handoff §"Tela grande"; a coluna cresce
  até lá e para, para o texto não virar linha de 1440px no desktop.
*/
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="papel-de-parede altura-tela overflow-hidden text-tinta">
      <main className="altura-tela mx-auto flex w-full max-w-[620px] flex-col px-margem pb-rodape-seguro pt-topo-seguro md:pt-[34px]">
        {children}
      </main>
    </div>
  );
}
