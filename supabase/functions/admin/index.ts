import { Router } from "../_shared/router.ts";
import { register as registerAdmin } from "../api/routes/admin.ts";
import { register as registerFinanceiro } from "../api/routes/financeiro.ts";
import { register as registerAssinaturas } from "../api/routes/assinaturas.ts";

const router = new Router();
registerAdmin(router);
registerFinanceiro(router);
registerAssinaturas(router);

Deno.serve((req) => router.handle(req, "admin"));
