/*
  Alerta por e-mail quando a Anthropic recusa por falta de crédito — é o
  único gatilho de propósito (não "qualquer erro 500"): é o caso que derruba
  quiz, trilha, resumo e chat de uma vez só, silenciosamente, até alguém
  reclamar (foi o que aconteceu em 2026-09-19). Um bug de código ou uma
  falha de rede pontual não passa por aqui.

  Envio via Resend (api.resend.com) — precisa de RESEND_API_KEY e
  ALERT_EMAIL_TO configurados como secret da Edge Function. Sem eles, só
  loga um aviso e segue (o alerta nunca pode ser o motivo de um 500 novo).
*/

import { db } from "./db.ts";

const COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2h — evita um e-mail por chamada
// que falhar em sequência (foram 5 chamadas em segundos no incidente real).

export function eErroDeCreditoAnthropic(mensagem: string): boolean {
  return mensagem.includes("credit balance is too low");
}

export async function alertarCreditoAnthropicBaixo(mensagemErro: string): Promise<void> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const emailPara = Deno.env.get("ALERT_EMAIL_TO");
  if (!resendApiKey || !emailPara) {
    console.error(
      "Aviso: RESEND_API_KEY ou ALERT_EMAIL_TO não configurados — alerta de crédito baixo não foi enviado.",
    );
    return;
  }

  try {
    const { data: estado } = await db()
      .from("system_alerts")
      .select("last_sent_at")
      .eq("kind", "anthropic_credito_baixo")
      .maybeSingle();

    const jaAvisadoRecentemente =
      estado?.last_sent_at &&
      Date.now() - new Date(estado.last_sent_at as string).getTime() < COOLDOWN_MS;
    if (jaAvisadoRecentemente) return;

    // Marca ANTES de enviar: se o envio falhar, prefere perder um alerta a
    // arriscar um loop de tentativa a cada chamada que falha.
    await db()
      .from("system_alerts")
      .upsert({ kind: "anthropic_credito_baixo", last_sent_at: new Date().toISOString() });

    const emailDe = Deno.env.get("ALERT_EMAIL_FROM") ?? "onboarding@resend.dev";
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: emailDe,
        to: emailPara,
        subject: "⚠️ Kango: os créditos da Anthropic acabaram",
        text:
          "A API da Anthropic recusou uma chamada por falta de crédito.\n\n" +
          "Isso derruba quiz, trilha, resumo e chat — o resto do app (login, materias, " +
          "progresso, upload de PDF) continua funcionando normal.\n\n" +
          "Recarregue em: https://console.anthropic.com/settings/billing\n" +
          "(considere ativar \"Auto-reload\" lá pra isso não parar de novo sem aviso)\n\n" +
          `Erro original: ${mensagemErro}`,
      }),
    });
    if (!resp.ok) {
      console.error("Aviso: Resend recusou o envio do alerta:", resp.status, await resp.text());
    }
  } catch (err) {
    // Nunca deixa o alerta virar a causa de um erro novo na chamada real.
    console.error("Aviso: falha ao processar alerta de crédito baixo:", err);
  }
}
