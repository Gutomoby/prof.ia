"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileUp, ListChecks, Target } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { capsuleVariants } from "@/components/ui/capsule";
import { InsetList, InsetRow } from "@/components/ui/inset-list";
import { KangoPlaceholder } from "@/components/ui/kango-placeholder";
import { usePrimeiroAcesso } from "@/components/onboarding/usePrimeiroAcesso";

/*
  Tela 05 · Boas-vindas.

  Primeira tela de quem acabou de criar a conta — é para cá que
  (auth)/criar-conta manda depois do cadastro, no lugar do /dashboard, que
  para quem não tem matéria nenhuma é só um vazio.

  A tela é pública de propósito: dá para chegar nela deslogado, e aí o botão
  principal leva ao cadastro em vez do fluxo. É o que a nota de rodapé do
  desenho promete ("Já com conta, o próximo passo é montar a matéria").

  Os três ícones usam teal, índigo e âmbar — as cores de matéria de
  lib/professor-color.ts, não estado. Por isso vão em iconClass e não em
  iconTone.
*/
export default function BoasVindasPage() {
  // null enquanto não se sabe: o botão principal aponta para lugares
  // diferentes com e sem sessão, e piscar de um para o outro seria pior que
  // esperar. Enquanto isso ele fica desabilitado.
  const [logado, setLogado] = useState<boolean | null>(null);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setLogado(Boolean(data.user)))
      .catch(() => setLogado(false));
  }, []);

  // Quem já tem matéria não está no primeiro acesso: a boas-vindas sai da
  // frente e o app abre direto. A checagem só roda com sessão — deslogado,
  // GET /professores devolveria a lista do usuário único do MVP.
  const checando = usePrimeiroAcesso({ destino: "/dashboard", ativo: logado === true });

  // Enquanto se sabe se há matéria, a tela não pisca: ela é curta e o
  // redirecionamento é imediato.
  if (logado === true && checando) return null;

  return (
    <div className="flex flex-1 flex-col items-center">
      <p className="flex-none text-[32px] font-bold leading-[34px] tracking-[0.37px] text-indigo">
        Kango
      </p>

      <div className="flex h-[168px] flex-none items-center justify-center">
        <KangoPlaceholder px={144} estado="acenando" className="shadow-[inset_0_0_0_1px_rgba(255,255,255,.9),0_18px_44px_rgba(67,56,202,.2)]" />
      </div>

      <h1 className="flex-none text-pretty text-center text-[28px] font-bold leading-[34px] tracking-[0.3px]">
        Seu professor sai do seu próprio material
      </h1>
      <p className="mt-[9px] max-w-[330px] flex-none text-pretty text-center text-corpo text-tinta-fraca">
        Você sobe a apostila, o resumo, a prova antiga. O Kango lê e cobra de você exatamente o que
        você erra.
      </p>

      <div className="mt-[18px] w-full flex-none">
        <InsetList>
          <InsetRow
            icon={<FileUp />}
            iconClass="h-[30px] w-[30px] rounded-icone bg-teal-700 text-papel"
            title={
              <>
                Lê só o que <strong className="font-semibold">você</strong> subiu
              </>
            }
          />
          <InsetRow
            icon={<ListChecks />}
            iconTone="indigo"
            title="Monta quiz do seu conteúdo"
          />
          <InsetRow
            icon={<Target />}
            iconClass="h-[30px] w-[30px] rounded-icone bg-amber-700 text-papel"
            title="Insiste no ponto fraco até virar forte"
          />
        </InsetList>
      </div>

      <div className="min-h-3 flex-1" />

      <Link
        href={logado ? "/comecar" : "/criar-conta"}
        aria-disabled={logado === null}
        className={capsuleVariants(
          "principal",
          true,
          logado === null ? "pointer-events-none opacity-50" : undefined
        )}
      >
        Montar minha matéria
      </Link>

      {!logado && (
        <Link
          href="/login"
          className="mt-[11px] flex-none rounded-chip px-3 py-1 text-[16px] font-medium text-indigo hover:bg-indigo/6 focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte"
        >
          Já tenho conta
        </Link>
      )}

      <p className="mt-[7px] max-w-[300px] flex-none text-center text-[12.5px] leading-[1.45] text-tinta-fraca">
        Já com conta, o próximo passo é montar a matéria.
      </p>
      <div className="h-7 flex-none" />
    </div>
  );
}
