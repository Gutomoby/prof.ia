/*
  Rota de Progresso — porta de routers/progresso.py.

  GET   /progresso        estado atual da progressão
  PATCH /progresso/meta   ajusta a meta diária de XP

  Global de propósito: sequência, nível e meta são conceitos por pessoa, não
  por matéria. O progresso por matéria continua em /score/{professor_id}
  (fase 4 da migração).
*/

import type { Router } from "../../_shared/router.ts";
import { currentUserId } from "../../_shared/auth.ts";
import { db } from "../../_shared/db.ts";
import { HttpError } from "../../_shared/http.ts";
import {
  META_DIARIA_LICOES,
  licoesHoje,
  nivelParaXp,
  progressoOuCriar,
  xpHojeDe,
} from "../../_shared/progresso.ts";

// deno-lint-ignore no-explicit-any
async function serializar(row: Record<string, any>) {
  const [level, xpNoNivel, xpDoNivel] = nivelParaXp(row.total_xp);
  return {
    total_xp: row.total_xp,
    level,
    xp_no_nivel: xpNoNivel,
    xp_do_nivel: xpDoNivel,
    current_streak: row.current_streak,
    longest_streak: row.longest_streak,
    last_activity_date: row.last_activity_date,
    daily_goal_xp: row.daily_goal_xp || 50,
    xp_hoje: xpHojeDe(row),
    // A home fala em lições; a tela de configurações, em XP. As duas metas
    // convivem e medem coisas diferentes — ver META_DIARIA_LICOES.
    meta_licoes: META_DIARIA_LICOES,
    licoes_hoje: await licoesHoje(row.user_id),
  };
}

export function register(router: Router): void {
  router.get("/progresso", async (ctx) => {
    const userId = await currentUserId(ctx.req);
    return await serializar(await progressoOuCriar(userId));
  });

  router.patch("/progresso/meta", async (ctx) => {
    const userId = await currentUserId(ctx.req);
    const payload = await ctx.body<{ daily_goal_xp?: unknown }>();

    const meta = payload.daily_goal_xp;
    if (typeof meta !== "number" || !Number.isInteger(meta) || meta < 10 || meta > 1000) {
      throw new HttpError(400, "daily_goal_xp precisa ser um inteiro entre 10 e 1000.");
    }

    await progressoOuCriar(userId); // garante que a linha existe
    const { data, error } = await db()
      .from("user_progress")
      .update({ daily_goal_xp: meta })
      .eq("user_id", userId)
      .select();
    if (error) throw new HttpError(500, error.message);
    return await serializar(data![0]);
  });
}
