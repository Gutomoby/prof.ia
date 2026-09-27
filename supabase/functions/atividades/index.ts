import { Router } from "../_shared/router.ts";
import { register as registerAtividades } from "../api/routes/atividades.ts";

const router = new Router();
registerAtividades(router);

Deno.serve((req) => router.handle(req, "atividades"));
