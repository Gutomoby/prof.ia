"use client";

import { useRef, useState } from "react";
import { Check, FileUp, X } from "lucide-react";
import { Capsule } from "@/components/ui/capsule";
import { InlineAlert } from "@/components/ui/inline-alert";
import { InsetList, InsetRow } from "@/components/ui/inset-list";
import { PassoHeader } from "@/components/onboarding/PassoHeader";
import { cn } from "@/lib/utils";

/*
  Tela 07 · Ensinar o Kango (2 de 3).

  É a mesma operação da tela 16 (Material · upload), com outra moldura: aqui
  ela é um passo do fluxo, com saída ("Fazer isso depois"), e sem a lista do
  que já foi lido — que numa matéria recém-criada está sempre vazia.

  Duas linhas do desenho mudaram porque falavam de iOS: o seletor de arquivo
  é o do navegador ("do seu computador"), e o idioma das questões não é
  escolha de ninguém — o system_prompt do professor é em português.
*/

export interface DadosMaterial {
  tipo: "pdf" | "texto";
  file?: File;
  nome?: string;
  texto?: string;
}

export function PassoMaterial({
  onVoltar,
  onEnviar,
  onPular,
  erro,
}: {
  onVoltar: () => void;
  onEnviar: (dados: DadosMaterial) => void;
  onPular: () => void;
  erro: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [modo, setModo] = useState<"pdf" | "texto">("pdf");
  const [file, setFile] = useState<File | null>(null);
  const [nome, setNome] = useState("");
  const [texto, setTexto] = useState("");

  return (
    <div className="flex flex-1 flex-col">
      <PassoHeader passo={2} onVoltar={onVoltar} />

      <div className="flex-none pt-5">
        <h1 className="text-pretty text-titulo-estado">Agora ensine ele</h1>
        <p className="mt-2 text-pretty text-corpo text-tinta-fraca">
          Ele só cobra o que você subir. Uma apostila já basta para começar, depois você acrescenta o
          resto.
        </p>
      </div>

      <div className="mt-5 flex-none rounded-grupo border-[1.5px] border-dashed border-indigo/45 bg-white/70 px-[18px] py-6 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-[18px] bg-indigo/12 text-indigo">
          <FileUp className="h-[26px] w-[26px]" />
        </span>

        {modo === "pdf" ? (
          <>
            <p className="mt-3 text-linha font-semibold">{file ? file.name : "Escolher um PDF"}</p>
            <p className="mt-1 text-nota text-tinta-fraca">
              {file
                ? "Toque em enviar para o Kango ler"
                : "Do Arquivos, do seu computador ou tirando foto"}
            </p>

            <input
              ref={inputRef}
              id="onboarding-pdf"
              type="file"
              accept=".pdf"
              className="sr-only"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />

            <div className="mt-3.5">
              {file ? (
                <Capsule block onClick={() => onEnviar({ tipo: "pdf", file })}>
                  Enviar PDF
                </Capsule>
              ) : (
                // Cápsula de rótulo: abre o seletor sem aninhar <button> num
                // <label>. Mesmo padrão da tela 16.
                <label
                  htmlFor="onboarding-pdf"
                  className={cn(
                    "flex h-capsula-secundaria w-full cursor-pointer items-center justify-center rounded-capsula",
                    "bg-indigo text-[16px] font-semibold text-papel shadow-capsula",
                    "transition-all duration-180 ease-out hover:bg-[hsl(226_57%_32%)] active:scale-[0.98]",
                    "focus-within:shadow-foco-forte"
                  )}
                >
                  Escolher arquivo
                </label>
              )}
            </div>

            <button
              type="button"
              onClick={() => setModo("texto")}
              className="mt-3 rounded-chip px-3 py-1 text-corpo font-medium text-indigo hover:bg-indigo/6 focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte"
            >
              Ou colar um texto
            </button>
          </>
        ) : (
          <>
            <p className="mt-3 text-linha font-semibold">Colar um texto</p>
            <p className="mt-1 text-nota text-tinta-fraca">
              Resumo, anotação de aula ou transcrição
            </p>

            <div className="mt-3.5 overflow-hidden rounded-cartao bg-white text-left shadow-hairline">
              <label className="relative flex min-h-linha-campo items-center gap-4 px-4">
                <span className="flex-none text-linha">Nome</span>
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Resumo aula 3"
                  className="min-w-0 flex-1 bg-transparent text-right text-linha placeholder:text-borda-forte focus:outline-none"
                />
                <span
                  aria-hidden
                  className="pointer-events-none absolute bottom-0 left-4 right-0 h-[0.5px] bg-borda"
                />
              </label>
              <textarea
                rows={5}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Cole aqui a anotação, o resumo ou a transcrição da aula."
                className="w-full resize-y bg-transparent px-4 py-3 text-corpo placeholder:text-borda-forte focus:outline-none"
              />
            </div>

            <div className="mt-3.5">
              <Capsule
                block
                disabled={!nome.trim() || !texto.trim()}
                onClick={() => onEnviar({ tipo: "texto", nome: nome.trim(), texto })}
              >
                Salvar texto
              </Capsule>
            </div>

            <button
              type="button"
              onClick={() => setModo("pdf")}
              className="mt-3 rounded-chip px-3 py-1 text-corpo font-medium text-indigo hover:bg-indigo/6 focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte"
            >
              Ou enviar um PDF
            </button>
          </>
        )}

        <p className="mt-3 text-[12.5px] text-tinta-fraca">
          Material em português ou inglês — as questões saem em português.
        </p>
      </div>

      {erro && (
        <div className="mt-4 flex-none">
          <InlineAlert>{erro}</InlineAlert>
        </div>
      )}

      <p className="mb-2 mt-[22px] flex-none px-rotulo-secao text-rotulo uppercase text-tinta-fraca">
        Serve como material
      </p>
      <div className="flex-none">
        <InsetList>
          <InsetRow
            icon={<Check strokeWidth={3} />}
            iconVariant="simples"
            iconClass="text-acerto"
            title="Apostila, slide da aula, resumo seu"
          />
          <InsetRow
            icon={<Check strokeWidth={3} />}
            iconVariant="simples"
            iconClass="text-acerto"
            title="Prova antiga e lista de exercícios"
          />
          <InsetRow
            icon={<X strokeWidth={3} />}
            iconVariant="simples"
            iconClass="text-erro"
            title={<span className="text-tinta-fraca">PDF escaneado sem texto (só imagem)</span>}
          />
        </InsetList>
      </div>

      <div className="min-h-3.5 flex-1" />

      <Capsule variant="texto" block onClick={onPular} className="text-tinta-fraca">
        Fazer isso depois
      </Capsule>
    </div>
  );
}
