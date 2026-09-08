"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { ChatText } from "@/components/ui/chat-text";
import { InlineAlert } from "@/components/ui/inline-alert";
import { KangoPlaceholder } from "@/components/ui/kango-placeholder";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/types";

/*
  Chat com o professor — RAG sobre todo o material da matéria (não só um
  capítulo, ao contrário do Resumo). Uma sessão só por professor: reabrir o
  chat continua a mesma conversa, não começa outra.
*/
export default function ChatPage({ params }: { params: { id: string } }) {
  const professorId = params.id;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .getChatHistory(professorId)
      .then((res) => setMessages(res.items))
      .catch((err) => setErro(err instanceof ApiError ? err.message : "Não foi possível carregar o chat."))
      .finally(() => setLoading(false));
  }, [professorId]);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, enviando]);

  async function enviar() {
    const mensagem = texto.trim();
    if (!mensagem || enviando) return;
    setErro(null);
    setEnviando(true);
    setTexto("");
    // Otimista: mostra a pergunta na hora, sem esperar a resposta do modelo.
    setMessages((prev) => [...prev, { role: "user", content: mensagem, created_at: new Date().toISOString() }]);
    try {
      const res = await api.sendChatMessage(professorId, mensagem);
      setMessages(res.items);
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível enviar a mensagem.");
      // A pergunta otimista fica na tela mesmo com erro — reenviar de novo
      // duplicaria; a pessoa lê o erro e tenta reescrever se quiser.
    } finally {
      setEnviando(false);
    }
  }

  function aoTeclar(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  }

  if (loading) {
    return (
      <div className="mx-auto flex max-w-[640px] flex-col gap-3">
        <Skeleton className="ml-auto h-10 w-2/3 rounded-cartao" />
        <Skeleton className="h-16 w-3/4 rounded-cartao" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[640px] flex-col">
      {erro && <InlineAlert className="mb-3">{erro}</InlineAlert>}

      <div className="flex min-h-[50vh] flex-1 flex-col gap-3 pb-[180px]">
        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <KangoPlaceholder px={72} estado="lendo" />
            <p className="max-w-[34ch] text-corpo text-tinta-fraca">
              Pergunte qualquer coisa sobre o material que você enviou — o Kango responde com base nele.
            </p>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            {m.role === "assistant" && (
              <span className="mr-2 flex-none self-end">
                <KangoPlaceholder px={28} estado="avatar" />
              </span>
            )}
            <div
              className={cn(
                "max-w-[80%] rounded-cartao px-4 py-2.5 text-corpo leading-[1.45]",
                m.role === "user" ? "bg-indigo text-papel" : "bg-cinza-tonal text-tinta"
              )}
            >
              <ChatText>{m.content}</ChatText>
            </div>
          </div>
        ))}

        {enviando && (
          <div className="flex justify-start">
            <span className="mr-2 flex-none self-end">
              <KangoPlaceholder px={28} estado="avatar" />
            </span>
            <div className="flex items-center gap-1 rounded-cartao bg-cinza-tonal px-4 py-3">
              <span className="movimento-essencial h-1.5 w-1.5 animate-pulse rounded-capsula bg-tinta-fraca" />
              <span className="movimento-essencial h-1.5 w-1.5 animate-pulse rounded-capsula bg-tinta-fraca [animation-delay:150ms]" />
              <span className="movimento-essencial h-1.5 w-1.5 animate-pulse rounded-capsula bg-tinta-fraca [animation-delay:300ms]" />
            </div>
          </div>
        )}

        <div ref={fimRef} />
      </div>

      {/* z-40 e o bottom deslocado: a barra de abas do celular (MobileNav) é
          fixed/z-30 e ocupa os últimos ~76px da tela — com z-20/bottom-0
          essa caixa de texto ficava escondida atrás dela (só sumia no
          desktop, onde a barra de abas não existe). */}
      <div className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-3 bottom-[calc(max(12px,env(safe-area-inset-bottom))+76px)] md:bottom-3.5">
        <div className="pointer-events-auto flex w-full max-w-[640px] items-end gap-2 rounded-[26px] bg-papel p-2 shadow-vidro-flutuante backdrop-blur-[24px]">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={aoTeclar}
            placeholder="Pergunte sobre o material..."
            rows={1}
            className="max-h-[120px] flex-1 resize-none bg-transparent px-3 py-2.5 text-corpo text-tinta placeholder:text-tinta-fraca focus:outline-none"
          />
          <button
            type="button"
            onClick={enviar}
            disabled={!texto.trim() || enviando}
            aria-label="Enviar"
            className={cn(
              "flex h-toque w-toque flex-none items-center justify-center rounded-capsula bg-indigo text-papel",
              "transition-opacity duration-140 disabled:opacity-40",
              "focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte"
            )}
          >
            <ArrowUp className="h-5 w-5" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
