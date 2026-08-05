import { QuizGuardProvider } from "@/components/layout/QuizGuardContext";

/*
  Casca do modo foco (handoff §08): "Lição, resultado e diagnóstico não têm
  sidebar: só a tela e uma saída. Nada compete com a questão."

  Por isso a lição vive num grupo de rotas próprio, fora de (app): sem sidebar,
  sem barra de abas, sem cabeçalho de matéria. Só o papel de parede e o
  conteúdo. Tentar esconder a casca de dentro de (app) daria o mesmo resultado
  visual com o dobro de condicional espalhada.

  O QuizGuardProvider continua porque os componentes de lição o consomem — aqui
  ele nunca chega a bloquear nada, já que não há navegação de casca para
  interceptar.
*/
export default function LicaoLayout({ children }: { children: React.ReactNode }) {
  return (
    <QuizGuardProvider>
      <div className="papel-de-parede altura-tela overflow-hidden text-tinta">
        <main className="altura-tela mx-auto w-full max-w-[860px] px-margem pb-[34px] pt-[60px] md:px-[26px] md:pt-[34px]">
          {children}
        </main>
      </div>
    </QuizGuardProvider>
  );
}
