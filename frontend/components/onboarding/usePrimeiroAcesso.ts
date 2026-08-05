"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

/*
  Guarda da PORTA do primeiro acesso: a tela 05 só se abre enquanto não há
  matéria nenhuma.

  Guardar a porta basta para a regra "o onboarding aparece uma vez": o único
  outro caminho para o fluxo dentro do app é o vazio das telas 12 e 14, que
  por definição só existe com a lista zerada. A rota /comecar em si fica
  aberta a quem digita a URL — o porquê está escrito lá.

  O sinal é o estado real (GET /professores devolve lista vazia?), não uma
  marca de "já viu o onboarding" guardada à parte. São dois motivos: não há
  onde guardar essa marca por usuário hoje, e a lista vazia é exatamente a
  condição que o fluxo resolve — quem apagou tudo e voltou a zero precisa dele
  de novo, e é para lá que o vazio da tela 12 aponta.

  Erro na chamada não bloqueia: preso numa tela em branco por causa de um GET
  que falhou é pior que ver o fluxo mais uma vez.
*/
export function usePrimeiroAcesso({
  destino,
  ativo = true,
}: {
  /** Para onde mandar quem já tem matéria. */
  destino: string;
  /** Adia a checagem (ex.: enquanto não se sabe se há sessão). */
  ativo?: boolean;
}) {
  const router = useRouter();
  const [checando, setChecando] = useState(true);

  useEffect(() => {
    if (!ativo) return;
    let vivo = true;

    api
      .listProfessors()
      .then(({ items }) => {
        if (!vivo) return;
        if (items.length > 0) router.replace(destino);
        else setChecando(false);
      })
      .catch(() => {
        if (vivo) setChecando(false);
      });

    return () => {
      vivo = false;
    };
  }, [router, destino, ativo]);

  return checando;
}
