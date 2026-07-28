"use client";

import { createContext, useContext, useState } from "react";

/*
  Bloqueia navegação para fora de um quiz em andamento sem confirmação.
  Provider vive em professor/[id]/layout.tsx; o botão Voltar do PageHeader
  lê o valor via useQuizGuard(). Fora do Provider (páginas sem quiz em
  andamento), o hook retorna o default abaixo — sempre seguro.
*/
interface QuizGuardValue {
  unsaved: boolean;
  setUnsaved: (unsaved: boolean) => void;
}

const QuizGuardContext = createContext<QuizGuardValue>({
  unsaved: false,
  setUnsaved: () => {},
});

export function QuizGuardProvider({ children }: { children: React.ReactNode }) {
  const [unsaved, setUnsaved] = useState(false);
  return <QuizGuardContext.Provider value={{ unsaved, setUnsaved }}>{children}</QuizGuardContext.Provider>;
}

export function useQuizGuard() {
  return useContext(QuizGuardContext);
}
