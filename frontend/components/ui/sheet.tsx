"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/*
  Folha de baixo. É o que o handoff usa para decisão destrutiva (tela 26,
  apagar a matéria): a tela de trás continua visível, desfocada, e a folha sobe
  com o que se perde escrito por extenso.

  Por que folha e não página: apagar é um desvio, não um destino. Mantendo a
  tela anterior atrás, cancelar devolve exatamente onde a pessoa estava.

  Fecha por Esc, pelo toque fora e pelo botão — três saídas, porque a saída
  aqui é o caminho seguro.
*/

export function Sheet({
  aberta,
  onFechar,
  titulo,
  children,
}: {
  aberta: boolean;
  onFechar: () => void;
  /** Rótulo acessível da folha. */
  titulo: string;
  children: React.ReactNode;
}) {
  React.useEffect(() => {
    if (!aberta) return;
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    document.addEventListener("keydown", aoTeclar);
    // Trava a rolagem de trás: sem isso o dedo arrasta a página sob a folha.
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = anterior;
    };
  }, [aberta, onFechar]);

  if (!aberta) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Fechar"
        onClick={onFechar}
        className="absolute inset-0 bg-tinta/20 backdrop-blur-[6px]"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={cn(
          "relative w-full max-w-[520px] animate-subir-rodape",
          "max-h-[92vh] overflow-y-auto rounded-t-[30px] bg-papel px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-2.5",
          "shadow-vidro-flutuante sm:rounded-[30px] sm:pb-5"
        )}
      >
        {/* Puxador: diz "isto sobe e desce" sem precisar de instrução. */}
        <span
          aria-hidden
          className="mx-auto mb-3 block h-1 w-9 rounded-capsula bg-borda-forte sm:hidden"
        />
        {children}
      </div>
    </div>
  );
}
