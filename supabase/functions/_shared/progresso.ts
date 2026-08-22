/*
  Progressão global do usuário — XP, nível e sequência. Porta de services/progress.py.

  Diferente de scoring.ts, que é sempre por professor, aqui tudo é agregado do
  usuário inteiro: o XP soma o esforço em todas as matérias e a sequência conta
  o dia em que ele estudou *qualquer* coisa.
*/

import { db, selectAll } from "./db.ts";
import {
  atividadesRespondidas,
  calcularStreak,
  corrigirQuestoes,
  hojeLocal,
  paraDataLocal,
  somarDias,
  statsPorTopico,
  type TentativaRespondida,
} from "./scoring.ts";

// XP por ação. Premiar a questão errada respondida é deliberado: o objetivo é
// recompensar tentativa, não acerto. Um app que só premia acerto ensina a
// evitar o difícil.
export const XP_QUESTAO_CORRETA = 5;
export const XP_QUESTAO_ERRADA = 1;
export const XP_ATIVIDADE_CONCLUIDA = 10;
export const XP_MATERIAL_INDEXADO = 20;
export const XP_TOPICO_DOMINADO = 50;

// Meta diária em LIÇÕES, que é como a home fala com o usuário ("1 de 2 lições").
export const META_DIARIA_LICOES = 2;

const LEVEL_THRESHOLDS = [250, 600, 1100, 1800, 2700];
const XP_POR_NIVEL_EXTRA = 1000;

/** (nível, XP dentro do nível, XP necessário para fechar o nível). */
export function nivelParaXp(totalXp: number): [number, number, number] {
  let nivel = 1;
  let anterior = 0;
  for (const limite of LEVEL_THRESHOLDS) {
    if (totalXp < limite) return [nivel, totalXp - anterior, limite - anterior];
    nivel++;
    anterior = limite;
  }
  const extras = Math.floor((totalXp - anterior) / XP_POR_NIVEL_EXTRA);
  return [nivel + extras, totalXp - (anterior + extras * XP_POR_NIVEL_EXTRA), XP_POR_NIVEL_EXTRA];
}

export async function professoresDoUsuario(userId: string): Promise<string[]> {
  const { data, error } = await db().from("professors").select("id").eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.id as string);
}

async function todasTentativas(professorIds: string[]): Promise<TentativaRespondida[]> {
  if (!professorIds.length) return [];
  return await selectAll<TentativaRespondida>((de, ate) =>
    db()
      .from("activity_results")
      .select("questions, answers, score_pct, created_at")
      .in("professor_id", professorIds)
      .eq("activity_type", "quiz")
      .not("score_pct", "is", null)
      .order("created_at")
      .range(de, ate)
  );
}

/*
  Reconstrói XP e sequência a partir do histórico que já existe no banco.

  Sem isso, ligar a progressão zeraria um usuário que já respondeu dezenas de
  quizzes. O XP de "tópico dominado" é creditado pelo domínio *atual* — não dá
  para saber em que dia cada tópico cruzou o limiar olhando só o agregado.
*/
async function valoresDeBackfill(userId: string): Promise<Record<string, unknown>> {
  const professorIds = await professoresDoUsuario(userId);
  const atividades = await todasTentativas(professorIds);

  let totalXp = 0;
  for (const atividade of atividades) {
    const { corrigidas } = corrigirQuestoes(atividade.questions ?? [], atividade.answers ?? {});
    for (const q of corrigidas) {
      if (q.correta) totalXp += XP_QUESTAO_CORRETA;
      else if (q.resposta_usuario !== null) totalXp += XP_QUESTAO_ERRADA;
    }
    totalXp += XP_ATIVIDADE_CONCLUIDA;
  }

  for (const professorId of professorIds) {
    const stats = statsPorTopico(await atividadesRespondidas(professorId));
    totalXp += stats.filter((t) => t.status === "dominado").length * XP_TOPICO_DOMINADO;
  }

  if (professorIds.length) {
    const { data } = await db().from("documents").select("id").in("professor_id", professorIds);
    totalXp += (data ?? []).length * XP_MATERIAL_INDEXADO;
  }

  const datas = atividades.map((a) => paraDataLocal(a.created_at));
  const streak = calcularStreak(datas);

  return {
    user_id: userId,
    total_xp: totalXp,
    current_streak: streak,
    longest_streak: streak,
    last_activity_date: datas.length ? datas.slice().sort().at(-1) : null,
  };
}

/*
  Descarta a linha de progresso para que ela seja recalculada na próxima leitura.

  Chamado ao apagar um professor: as atividades dele somem em cascata, então o
  XP acumulado a partir delas deixa de ter lastro.
*/
export async function resetarProgresso(userId: string): Promise<void> {
  await db().from("user_progress").delete().eq("user_id", userId);
}

export async function progressoOuCriar(userId: string): Promise<Record<string, any>> {
  const { data } = await db().from("user_progress").select("*").eq("user_id", userId).limit(1);
  if (data && data.length) return data[0];

  const { data: inserido } = await db()
    .from("user_progress")
    .insert(await valoresDeBackfill(userId))
    .select();
  if (inserido && inserido.length) return inserido[0];

  // Corrida rara (duas requisições criando ao mesmo tempo): relê a linha.
  const { data: relido } = await db().from("user_progress").select("*").eq("user_id", userId).limit(1);
  return relido![0];
}

/*
  Lições concluídas hoje — quizzes respondidos, no fuso do usuário.

  Derivado de activity_results em vez de virar contador: um contador precisaria
  zerar à meia-noite e ficaria fora de sincronia se uma atividade fosse apagada.
  A janela de 2 dias no filtro é folga de fuso; o corte exato fica aqui.
*/
export async function licoesHoje(userId: string): Promise<number> {
  const professorIds = await professoresDoUsuario(userId);
  if (!professorIds.length) return 0;

  const desde = new Date(Date.now() - 2 * 86400_000).toISOString();
  const { data } = await db()
    .from("activity_results")
    .select("created_at")
    .in("professor_id", professorIds)
    .eq("activity_type", "quiz")
    .not("score_pct", "is", null)
    .gte("created_at", desde);

  const hoje = hojeLocal();
  return (data ?? []).filter((r) => paraDataLocal(r.created_at as string) === hoje).length;
}

/** XP de hoje. A coluna só vale se a data bater — zerar à meia-noite é implícito. */
export function xpHojeDe(linha: Record<string, any>): number {
  return linha.xp_today_date === hojeLocal() ? (linha.xp_today ?? 0) : 0;
}

/*
  Credita XP e, se a ação contar como estudo do dia, atualiza a sequência.

  Só atividade concluída mexe na sequência — subir material rende XP mas não
  mantém o streak vivo, senão bastaria fazer upload para "estudar".
*/
export async function creditarXp(
  userId: string,
  quantidade: number,
  contaParaStreak = false,
): Promise<Record<string, any>> {
  const atual = await progressoOuCriar(userId);

  const patch: Record<string, unknown> = {
    total_xp: (atual.total_xp ?? 0) + quantidade,
    xp_today: xpHojeDe(atual) + quantidade,
    xp_today_date: hojeLocal(),
    updated_at: new Date().toISOString(),
  };

  if (contaParaStreak) {
    const hoje = hojeLocal();
    const ultima = atual.last_activity_date as string | null;

    let streak: number;
    if (ultima === hoje) streak = atual.current_streak; // já estudou hoje
    else if (ultima === somarDias(hoje, -1)) streak = atual.current_streak + 1;
    else streak = 1;

    patch.current_streak = streak;
    patch.longest_streak = Math.max(atual.longest_streak ?? 0, streak);
    patch.last_activity_date = hoje;
  }

  const { data } = await db().from("user_progress").update(patch).eq("user_id", userId).select();
  return data && data.length ? data[0] : await progressoOuCriar(userId);
}
