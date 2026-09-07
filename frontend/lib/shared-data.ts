/*
  Dados compartilhados entre abas, via SWR.

  Antes: cada tela ("Estudar", Matérias, Calendário, Biblioteca...) buscava
  professores/progresso do zero no próprio useEffect, com seu próprio
  `loading`. Trocar de aba desmonta a tela anterior e monta a nova sem
  nenhum dado — toda troca virava um round-trip novo e um flash de skeleton,
  mesmo pra dado que não mudou nos últimos segundos.

  SWR resolve isso com uma cache por chave compartilhada entre todas as
  telas que chamam o mesmo hook: quem chega primeiro busca, quem chega
  depois (outra aba) recebe o dado em cache na hora e revalida por trás —
  a troca de aba passa a parecer instantânea depois da primeira visita.
*/
import useSWR from "swr";
import { api } from "./api";

export function useProfessors() {
  const { data, error, isLoading, mutate } = useSWR("professores", () =>
    api.listProfessors().then((res) => res.items)
  );
  return { professors: data ?? [], error, loading: isLoading, mutate };
}

export function useProgress() {
  const { data, error, isLoading, mutate } = useSWR("progresso", () => api.getProgress());
  return { progress: data ?? null, error, loading: isLoading, mutate };
}

export function useAllDocuments() {
  const { data, error, isLoading, mutate } = useSWR("documentos", () =>
    api.listAllDocuments().then((res) => res.items)
  );
  return { documents: data ?? [], error, loading: isLoading, mutate };
}
