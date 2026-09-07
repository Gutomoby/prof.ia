"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";
import { LocalNotifications } from "@capacitor/local-notifications";

/*
  Ponte com o app nativo (Capacitor) — só existe efeito quando o site está
  rodando DENTRO do WebView do app (mobile/), nunca no navegador comum.

  O app nativo carrega este mesmo site em produção (mobile/capacitor.config.ts,
  server.url) em vez de um bundle empacotado, então o único jeito de chamar
  plugin nativo é daqui, do próprio código do site — não existe um "main.ts"
  separado do lado do app que rode de verdade.

  Lembrete diário local (sem servidor/APNs) é a funcionalidade nativa que
  justifica o app na revisão da Apple (guideline 4.2 — WebView puro sem nada
  nativo é motivo comum de rejeição).
*/
export function CapacitorNative() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    StatusBar.setStyle({ style: Style.Light }).catch(() => {});
    SplashScreen.hide().catch(() => {});

    LocalNotifications.requestPermissions()
      .then(({ display }) => {
        if (display !== "granted") return;
        // id fixo: reenviar o mesmo agendamento em cada abertura do app
        // substitui o anterior em vez de acumular notificações duplicadas.
        return LocalNotifications.schedule({
          notifications: [
            {
              id: 1,
              title: "Kango",
              body: "Sua sequência de estudos te espera hoje.",
              schedule: { on: { hour: 19, minute: 0 }, every: "day" },
            },
          ],
        });
      })
      .catch(() => {
        // Lembrete é conveniência, não funcionalidade crítica — sem
        // permissão ou erro do plugin, o app continua normal.
      });
  }, []);

  return null;
}
