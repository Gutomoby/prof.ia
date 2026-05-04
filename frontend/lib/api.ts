/*
  Wrapper fino para chamar o backend FastAPI.

  Cada função aqui corresponde a um endpoint do backend. O objetivo é
  centralizar a URL base (NEXT_PUBLIC_API_URL) e o tratamento de erro,
  para que as telas só importem funções tipadas e nunca lidem com fetch direto.
*/

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// Erro lançado quando a API responde com status != 2xx.
// Carrega o status e a mensagem do backend para exibir na UI.
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

// Helper interno — todos os métodos abaixo passam por aqui.
// Adiciona JSON headers e converte respostas em erro num ApiError com mensagem.
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new ApiError(res.status, body || res.statusText);
  }

  // Algumas rotas (ex.: streaming) não retornam JSON — caller usa fetch direto nesses casos.
  return res.json() as Promise<T>;
}

// Funções específicas serão adicionadas conforme implementarmos os endpoints
// (ex.: createProfessor, listProfessors, sendMessage, etc.). Por enquanto apenas
// expomos o `request` para facilitar o boot.
export const api = { request };
