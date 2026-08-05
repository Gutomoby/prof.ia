"use client";

import { Check, Loader2 } from "lucide-react";
import { InsetList } from "@/components/ui/inset-list";
import { KangoPlaceholder } from "@/components/ui/kango-placeholder";
import { PassoHeader } from "@/components/onboarding/PassoHeader";

/*
  Tela 08 · Lendo seu material (2 de 3).

  Três coisas do desenho não existem do lado de cá, e cada uma virou o que se
  sabe de verdade:

  1. "página 8 de 34" — o upload em routers/documentos.py é síncrono (extrai,
     indexa e só então responde) e a tabela `documents` não guarda contagem de
     páginas nem status. Então a barra é indeterminada e a linha diz em qual
     das DUAS etapas o app está, que é o que ele de fato sabe.
  2. "idioma: português" — ninguém detecta idioma em lugar nenhum.
  3. "Pode fechar o app, eu continuo lendo" — seria mentira: fechar a aba
     aborta o fetch e o material se perde no meio.

  Os tópicos aparecem juntos, não um a um: eles chegam de uma vez em
  POST /modulos/gerar. O que é escalonado é só a entrada de cada linha, e isso
  é apresentação — nenhuma linha aparece antes do dado dela existir.
*/
export function PassoLendo({
  nomeArquivo,
  etapa,
  topicos,
}: {
  nomeArquivo: string;
  /** "lendo" enquanto o arquivo sobe; "organizando" enquanto a IA separa os tópicos. */
  etapa: "lendo" | "organizando";
  topicos: string[];
}) {
  return (
    <div className="flex flex-1 flex-col items-center">
      <div className="w-full flex-none">
        <PassoHeader passo={2} />
      </div>

      <div className="flex w-full flex-1 flex-col items-center justify-center">
        <KangoPlaceholder px={118} estado="lendo" />

        <h1 className="mt-[22px] text-center text-[28px] font-bold leading-[34px] tracking-[0.3px]">
          Lendo seu material
        </h1>
        <p className="mt-2 max-w-full truncate text-center text-corpo text-tinta-fraca">
          {nomeArquivo}
        </p>

        <div
          role="progressbar"
          aria-label="Lendo o material"
          className="relative mt-4 h-2 w-full overflow-hidden rounded-capsula bg-cinza-tonal"
        >
          <span
            aria-hidden
            className="movimento-essencial absolute inset-y-0 left-0 w-1/4 animate-indeterminada rounded-capsula bg-indigo"
          />
        </div>
        <p className="mt-2 text-nota text-tinta-fraca">
          {etapa === "lendo" ? "Tirando o texto do arquivo" : "Separando os tópicos"}
        </p>

        <p className="mb-2 mt-6 w-full flex-none px-rotulo-secao text-rotulo uppercase text-tinta-fraca">
          Já encontrei
        </p>
        <InsetList>
          {topicos.map((topico, i) => (
            <div key={topico} className="relative flex min-h-[50px] items-center gap-3 px-4">
              <Check className="h-[17px] w-[17px] flex-none text-acerto" strokeWidth={3} />
              <span
                className="min-w-0 flex-1 animate-in fade-in slide-in-from-bottom-1 truncate text-linha duration-250"
                style={{ animationDelay: `${Math.min(i, 8) * 0.06}s` }}
              >
                {topico}
              </span>
              <span
                aria-hidden
                data-sep
                className="pointer-events-none absolute bottom-0 left-[45px] right-0 h-[0.5px] bg-borda"
              />
            </div>
          ))}

          {/* A linha em branco com spinner é o "ainda vem mais": some quando a
              organização termina, e nunca aparece sozinha prometendo tópico
              que não existe. */}
          <div className="relative flex min-h-[50px] items-center gap-3 px-4">
            <Loader2 className="h-[17px] w-[17px] flex-none animate-spin text-indigo" />
            <span aria-hidden className="h-3.5 w-full max-w-[190px] rounded-[7px] bg-cinza-tonal" />
            <span className="sr-only">Procurando mais tópicos</span>
            <span
              aria-hidden
              data-sep
              className="pointer-events-none absolute bottom-0 left-[45px] right-0 h-[0.5px] bg-borda"
            />
          </div>
        </InsetList>

        <p className="mt-3.5 max-w-[300px] text-center text-nota leading-[1.45] text-tinta-fraca">
          Leva alguns segundos. Deixe esta tela aberta enquanto ele lê.
        </p>
      </div>
    </div>
  );
}
