import { redirect } from "next/navigation";

// Rota raiz — manda o usuário pra home autenticada.
// O middleware de auth (a ser criado) vai redirecionar para /login se não estiver logado.
export default function RootPage() {
  redirect("/");
}
