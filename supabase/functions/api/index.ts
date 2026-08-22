/*
  Entrypoint da API migrada — substitui o FastAPI (backend/main.py), rota a
  rota, mantendo os mesmos paths (ver _shared/router.ts).

  Cada domínio migrado ganha um import + register(router) aqui. O arquivo
  cresce por importação a cada fase da migração; nunca é reescrito.
*/

import { Router } from "../_shared/router.ts";
import { register as registerConquistas } from "./routes/conquistas.ts";
import { register as registerProgresso } from "./routes/progresso.ts";
import { register as registerProfessores } from "./routes/professores.ts";
import { register as registerCalendario } from "./routes/calendario.ts";
import { register as registerAdmin } from "./routes/admin.ts";
import { register as registerFinanceiro } from "./routes/financeiro.ts";
import { register as registerModulos } from "./routes/modulos.ts";
import { register as registerScore } from "./routes/score.ts";
import { register as registerAtividades } from "./routes/atividades.ts";
import { register as registerDocumentos } from "./routes/documentos.ts";

const router = new Router();
registerConquistas(router);
registerProgresso(router);
registerProfessores(router);
registerCalendario(router);
registerAdmin(router);
registerFinanceiro(router);
registerModulos(router);
registerScore(router);
registerAtividades(router);
registerDocumentos(router);

Deno.serve((req) => router.handle(req, "api"));
