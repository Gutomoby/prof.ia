"use client";

import * as React from "react";

/*
  Ação contextual do canto superior direito.

  O handoff põe ali uma ação que pertence à TELA, não à casca: "Salvar" nos
  ajustes (tela 25), "Cancelar" enquanto o quiz é gerado (tela 23). O cabeçalho
  é renderizado pelo layout da sala, um nível acima da página, então a página
  precisa de um caminho para entregar esse nó ao cabeçalho.

  É deliberadamente burro: um nó React de cada vez, o último a registrar vence,
  e quem registrou limpa ao sair. Nada de fila nem prioridade — se duas telas
  disputarem o mesmo canto, é sinal de que a hierarquia está errada, não de que
  falta mecanismo aqui.
*/

type Ctx = {
  node: React.ReactNode;
  setNode: (node: React.ReactNode) => void;
};

const HeaderActionContext = React.createContext<Ctx>({ node: null, setNode: () => {} });

export function HeaderActionProvider({ children }: { children: React.ReactNode }) {
  const [node, setNode] = React.useState<React.ReactNode>(null);
  const value = React.useMemo(() => ({ node, setNode }), [node]);
  return <HeaderActionContext.Provider value={value}>{children}</HeaderActionContext.Provider>;
}

/** Lido pelo cabeçalho. */
export function useHeaderAction() {
  return React.useContext(HeaderActionContext).node;
}

/**
 * Chamado pela página. `deps` funciona como no useEffect — inclua tudo que o
 * nó lê, senão o botão congela no primeiro estado (um "Salvar" que nunca
 * habilita, por exemplo).
 */
export function useSetHeaderAction(node: React.ReactNode, deps: React.DependencyList) {
  const { setNode } = React.useContext(HeaderActionContext);
  React.useEffect(() => {
    setNode(node);
    return () => setNode(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
