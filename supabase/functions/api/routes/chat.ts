/*
  Chat com o professor — RAG sobre TODO o material do professor (ao contrário
  do resumo, que é travado a um módulo). Uma sessão por professor
  (chat_sessions.professor_id), mensagens acumuladas em `messages` (jsonb).

  GET  /professores/:id/chat    histórico da sessão (vazio se ainda não existe)
  POST /professores/:id/chat    manda uma mensagem, recebe a resposta
*/
import type { Router } from "../../_shared/router.ts";
import { currentUserId, getOwnedProfessor } from "../../_shared/auth.ts";
import { db } from "../../_shared/db.ts";
import { HttpError } from "../../_shared/http.ts";
import { NOTACAO_MATEMATICA, generateChatReply } from "../../_shared/claude.ts";
import { normalizarProfundo } from "../../_shared/notacao.ts";
import { searchChunks } from "../../_shared/embeddings.ts";

type ChatMessage = { role: "user" | "assistant"; content: string; created_at: string };

// Últimas N mensagens mandadas pro modelo como contexto — o histórico salvo
// no banco não tem esse limite, só o que viaja de novo a cada chamada.
const MAX_HISTORICO = 20;

async function getSession(professorId: string): Promise<{ id: string; messages: ChatMessage[] } | null> {
  const { data, error } = await db()
    .from("chat_sessions")
    .select("id, messages")
    .eq("professor_id", professorId)
    .limit(1);
  if (error) throw new HttpError(500, error.message);
  if (!data || !data.length) return null;
  return { id: data[0].id as string, messages: (data[0].messages as ChatMessage[]) ?? [] };
}

export function register(router: Router): void {
  router.get("/professores/:id/chat", async (ctx) => {
    const userId = await currentUserId(ctx.req);
    const professorId = ctx.params.id;
    await getOwnedProfessor(professorId, userId, "id");

    const sessao = await getSession(professorId);
    return { items: normalizarProfundo(sessao?.messages ?? []) };
  });

  router.post("/professores/:id/chat", async (ctx) => {
    const userId = await currentUserId(ctx.req);
    const professorId = ctx.params.id;
    const professor = await getOwnedProfessor(professorId, userId, "id, discipline, system_prompt");

    const payload = await ctx.body<{ message?: unknown }>();
    const mensagem = (payload.message as string | undefined)?.trim();
    if (!mensagem) throw new HttpError(400, 'Campo "message" é obrigatório.');

    const chunks = await searchChunks(professorId, mensagem, 8);
    const context = chunks.map((c) => c.content).join("\n\n---\n\n") || "(nenhum material enviado ainda)";
    const systemPrompt =
      ((professor.system_prompt as string) ?? "").replace("{chunks_retrieved}", context) +
      "\n\nVocê está numa conversa de chat com o aluno — respostas mais curtas e diretas que num resumo, " +
      "no tom de uma conversa mesmo. Se a pergunta fugir da matéria, traga de volta pra ela com gentileza. " +
      "FORMATAÇÃO: pode usar **negrito** para destacar um termo e listas com \"- \" quando fizer sentido " +
      "— só isso, nada de markdown além disso (sem #, sem tabela, sem link). Ao decompor uma fórmula em " +
      "partes (ex.: dotal misto = pecúlio temporário + dotal puro), NUNCA escreva a equação inteira como " +
      "um bloco de várias linhas — quebre em uma lista, uma linha por termo, cada linha com NO MÁXIMO uma " +
      "fórmula curta entre $ e $ seguida do que ela significa (ex.: \"- $_{20}E_{40}$ = dotal puro\"). " +
      NOTACAO_MATEMATICA;

    // A sessão precisa existir ANTES da chamada ao modelo — token_logs.resource_id
    // aponta pra ela, e uma sessão nova só ganha id ao ser inserida. Criar vazia
    // aqui (em vez de só depois de ter a resposta) também simplifica: dali em
    // diante é sempre update, nunca mais precisa decidir insert-ou-update.
    let sessaoAtual = await getSession(professorId);
    if (!sessaoAtual) {
      const { data, error } = await db()
        .from("chat_sessions")
        .insert({ professor_id: professorId, messages: [] })
        .select("id, messages");
      if (error) throw new HttpError(500, error.message);
      sessaoAtual = { id: data![0].id as string, messages: [] };
    }

    const historicoAnterior = sessaoAtual.messages;
    const historicoParaModelo = [
      ...historicoAnterior.slice(-MAX_HISTORICO).map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: mensagem },
    ];

    const resposta = await generateChatReply(systemPrompt, historicoParaModelo, userId, professorId, sessaoAtual.id);

    const novasMensagens: ChatMessage[] = [
      ...historicoAnterior,
      { role: "user", content: mensagem, created_at: new Date().toISOString() },
      { role: "assistant", content: resposta, created_at: new Date().toISOString() },
    ];

    const { error } = await db()
      .from("chat_sessions")
      .update({ messages: novasMensagens, updated_at: new Date().toISOString() })
      .eq("id", sessaoAtual.id);
    if (error) throw new HttpError(500, error.message);

    return { items: normalizarProfundo(novasMensagens) };
  });
}
