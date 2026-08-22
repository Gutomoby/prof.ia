/*
  Rota de Conquistas — porta de routers/conquistas.py.

  GET /conquistas   estado das conquistas do usuário

  Só leitura: as conquistas são derivadas do histórico a cada chamada (ver
  _shared/achievements.ts), não há o que criar nem atualizar.
*/

import type { Router } from "../../_shared/router.ts";
import { currentUserId } from "../../_shared/auth.ts";
import { conquistasDoUsuario } from "../../_shared/achievements.ts";

export function register(router: Router): void {
  router.get("/conquistas", async (ctx) => {
    const userId = await currentUserId(ctx.req);
    const items = await conquistasDoUsuario(userId);
    return { items, ganhas: items.filter((i) => i.ganha).length, total: items.length };
  });
}
