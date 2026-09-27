import { Router } from "../_shared/router.ts";
import { register as registerModulos } from "../api/routes/modulos.ts";
import { register as registerResumos } from "../api/routes/resumos.ts";
import { register as registerChat } from "../api/routes/chat.ts";

const router = new Router();
registerModulos(router);
registerResumos(router);
registerChat(router);

Deno.serve((req) => router.handle(req, "ia"));
