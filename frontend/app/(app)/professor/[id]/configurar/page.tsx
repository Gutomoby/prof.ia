"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Check,
  FileText,
  FileX,
  Loader2,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Trash2,
  Type,
  Upload,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Capsule, capsuleVariants } from "@/components/ui/capsule";
import { InlineAlert } from "@/components/ui/inline-alert";
import { InsetList, InsetRow } from "@/components/ui/inset-list";
import { MetricText } from "@/components/ui/metric-text";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { MathText } from "@/components/ui/math-text";
import { PainelAuxiliar, PainelLinha, PainelPrincipal } from "@/components/layout/Painel";
import { cn } from "@/lib/utils";
import type { DocumentItem } from "@/lib/types";

/*
  Tela 16 · Material · upload.

  O cabeçalho (volta, nome da matéria, abas) vem do layout da sala em
  professor/[id]/layout.tsx — aqui mora só o conteúdo.

  Uma diferença que o handoff não tem como mostrar: a linha ativa do desenho diz
  "Lendo · página 3 de 8", e esse dado não existe. O upload em
  backend/routers/documentos.py é síncrono — extrai, indexa e só então responde
  —, e a tabela `documents` não tem contagem de páginas nem coluna de status.
  Enquanto a requisição está no ar a linha aparece com o mesmo tratamento visual
  (fundo índigo a 8%, ícone cheio, spinner), dizendo o que de fato se sabe:
  que está lendo. Página a página exige indexação assíncrona com status
  persistido — item 5 do consolidado de backend no plano.
*/

type Aba = "pdf" | "texto";

function AreaUpload({
  titulo,
  nota,
  children,
}: {
  titulo: string;
  nota: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-grupo border-[1.5px] border-dashed border-indigo/45 px-[18px] py-[22px] text-center",
        "vidro-abas"
      )}
    >
      <span className="mx-auto flex h-[52px] w-[52px] items-center justify-center rounded-chip bg-indigo/12 text-indigo">
        <Upload className="h-6 w-6" />
      </span>
      <p className="mt-3 text-linha font-semibold">{titulo}</p>
      <p className="mt-[3px] text-nota text-tinta-fraca">{nota}</p>
      <div className="mt-3.5">{children}</div>
    </div>
  );
}

export default function ConfigurarPage({ params }: { params: { id: string } }) {
  const professorId = params.id;

  const [aba, setAba] = useState<Aba>("pdf");
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  // Nome do arquivo recusado por não ter texto — dispara a tela 43.
  const [pdfSemTexto, setPdfSemTexto] = useState<string | null>(null);

  const [textName, setTextName] = useState("");
  const [textContent, setTextContent] = useState("");
  const [textError, setTextError] = useState<string | null>(null);
  const [textLoading, setTextLoading] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [updatingModules, setUpdatingModules] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  // Quantos capítulos entraram na última atualização. `null` = ainda não rodou
  // nesta visita. Sem isso a ação não tinha resposta visível: o botão voltava
  // ao normal e não dava para saber se a trilha cresceu, encolheu ou nada mudou.
  const [novosCapitulos, setNovosCapitulos] = useState<number | null>(null);
  // Ligado assim que um material entra: a trilha não se atualiza sozinha, e sem
  // dizer isso a pessoa sobe o PDF e fica esperando o quiz aparecer.
  const [precisaAtualizarTrilha, setPrecisaAtualizarTrilha] = useState(false);

  // Tópicos que o Kango tirou do material (vêm dos módulos) e quantos
  // capítulos a trilha tem hoje.
  const [topicos, setTopicos] = useState<string[]>([]);
  const [nCapitulos, setNCapitulos] = useState(0);

  // Nome do que está sendo lido agora — alimenta a linha ativa da lista.
  const lendo = pdfLoading ? pdfFile?.name : textLoading ? textName : null;

  async function refreshDocuments() {
    setLoadingList(true);
    setListError(null);
    try {
      const res = await api.listDocuments(professorId);
      setDocuments(res.items);
    } catch {
      setListError("Não foi possível carregar os materiais.");
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    refreshDocuments();
    api
      .listModules(professorId)
      .then(({ items }) => {
        setTopicos([...new Set(items.flatMap((m) => m.topics))]);
        setNCapitulos(items.length);
      })
      .catch(() => {
        setTopicos([]);
        setNCapitulos(0);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professorId]);

  /*
    Erro de envio, escrito do lado de quem está esperando.

    "Falha ao enviar o PDF" não diz o que houve nem o que fazer — e o caso mais
    comum aqui é justamente o que mais assusta: arquivo grande, a leitura
    demora, algo estoura no caminho. O usuário via o erro, saía da tela, voltava
    e encontrava o arquivo listado; concluía que o app mente. (Ele meio que
    mentia: o registro entrava e a indexação não — corrigido em 22de548, com o
    documento sendo removido quando a leitura falha.)

    Cada mensagem abaixo termina no próximo passo concreto.
  */
  function mensagemDeEnvio(err: unknown, arquivo: string): string {
    if (!(err instanceof ApiError)) {
      // Sem status HTTP: a requisição nem chegou ao fim. Em arquivo grande é o
      // caso típico — a conexão cai antes da leitura terminar.
      return `A conexão caiu antes do Kango terminar de ler ${arquivo}. Nada foi salvo. Tente de novo — em arquivo grande, ficar nesta tela até o fim ajuda.`;
    }
    if (err.status === 401) {
      return "Sua sessão expirou enquanto o arquivo subia. Entre de novo e reenvie.";
    }
    if (err.status === 413) {
      return `${arquivo} passou do tamanho aceito. Divida em partes menores (por capítulo, por exemplo) e envie uma de cada vez.`;
    }
    if (err.status >= 500) {
      return `O Kango não conseguiu ler ${arquivo} até o fim, então não salvou nada pela metade. Tente enviar de novo; se repetir, divida o arquivo em partes.`;
    }
    return err.message;
  }

  async function handlePdfSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pdfFile) return;
    const nome = pdfFile.name;
    setPdfError(null);
    setPdfSemTexto(null);
    setPdfLoading(true);
    try {
      await api.uploadPdf(professorId, pdfFile);
      setPdfFile(null);
      if (inputRef.current) inputRef.current.value = "";
      await refreshDocuments();
      // Material novo só vira questão depois de entrar na trilha, e isso é uma
      // ação separada — dizer isso aqui evita a espera por algo que não vem.
      setNovosCapitulos(null);
      setPrecisaAtualizarTrilha(true);
    } catch (err) {
      // 43 · PDF sem texto. O backend recusa PDF escaneado antes de gravar
      // qualquer coisa (services/pdf.py não extraiu nada), e um alerta seco não
      // diz o que fazer — este é o erro mais comum de quem sobe slide fotografado.
      const semTexto =
        err instanceof ApiError && /extrair texto|escaneado/i.test(err.message);
      if (semTexto) setPdfSemTexto(nome);
      else setPdfError(mensagemDeEnvio(err, nome));
    } finally {
      setPdfLoading(false);
    }
  }

  async function handleTextSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTextError(null);
    setTextLoading(true);
    try {
      await api.uploadText({ professor_id: professorId, name: textName, raw_text: textContent });
      setTextName("");
      setTextContent("");
      await refreshDocuments();
      setNovosCapitulos(null);
      setPrecisaAtualizarTrilha(true);
    } catch (err) {
      setTextError(mensagemDeEnvio(err, textName || "o texto"));
    } finally {
      setTextLoading(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleteError(null);
    setDeletingId(id);
    try {
      await api.deleteDocument(id);
      await refreshDocuments();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Falha ao excluir o material.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleUpdateTrilha() {
    setUpdateError(null);
    setNovosCapitulos(null);
    setUpdatingModules(true);
    const antes = nCapitulos;
    try {
      const res = await api.listModules(professorId, { regen: true });
      setTopicos([...new Set(res.items.flatMap((m) => m.topics))]);
      setNCapitulos(res.items.length);
      // Zero capítulos novos é resposta legítima (o material já está coberto),
      // não erro — o backend devolve a trilha atual nesse caso.
      setNovosCapitulos(Math.max(0, res.items.length - antes));
      setPrecisaAtualizarTrilha(false);
    } catch (err) {
      setUpdateError(
        err instanceof ApiError && err.status >= 500
          ? "O Kango não conseguiu ler o material inteiro desta vez. A trilha continua como estava — nada foi perdido. Tente de novo em alguns instantes."
          : err instanceof ApiError
            ? err.message
            : "A conexão caiu no meio da leitura. A trilha continua como estava; tente de novo."
      );
    } finally {
      setUpdatingModules(false);
    }
  }

  if (pdfSemTexto) {
    return (
      <div className="mx-auto flex max-w-[560px] flex-col">
        <span className="flex h-[76px] w-[76px] items-center justify-center rounded-grupo bg-erro/12 text-erro">
          <FileX className="h-8 w-8" />
        </span>
        <h1 className="mt-3.5 text-pretty text-titulo-grande text-tinta">
          Esse PDF não tem texto pra ler
        </h1>
        <p className="mt-2 text-pretty text-corpo text-tinta-fraca">
          Parece um arquivo escaneado, só imagem. Sem texto, o Kango não consegue tirar questões
          dele.
        </p>

        <div className="mt-4 flex items-center gap-3 rounded-cartao vidro-cartao px-4 py-3 shadow-hairline">
          <FileText className="h-[17px] w-[17px] flex-none text-tinta-fraca" />
          <span className="min-w-0 flex-1 truncate text-corpo text-tinta">{pdfSemTexto}</span>
        </div>

        <div className="mt-[22px]">
          <InsetList label="O que dá pra fazer">
            <InsetRow
              altura="dupla"
              icon={<Type />}
              iconTone="indigo"
              title="Colar o texto na mão"
              subtitle="Copie do PDF ou do slide e cole na aba Texto"
              onClick={() => {
                setPdfSemTexto(null);
                setPdfFile(null);
                setAba("texto");
              }}
            />
            <InsetRow
              altura="dupla"
              icon={<Upload />}
              title="Enviar outro arquivo"
              subtitle="PDF salvo do computador costuma ter texto"
              onClick={() => {
                setPdfSemTexto(null);
                setPdfFile(null);
              }}
            />
            <InsetRow
              disabled
              altura="dupla"
              icon={<ScanLine />}
              title={<span className="text-tinta-fraca">Ler foto e escaneado</span>}
              subtitle="Em breve"
            />
          </InsetList>
        </div>
      </div>
    );
  }

  return (
    /*
      56 · Material no computador. Coluna principal com o upload e o que já foi
      lido; auxiliar de 400px com a garantia do RAG e os tópicos que saíram do
      material — os dois blocos que, no celular, ou não cabem ou virariam mais
      rolagem depois da lista.
    */
    <div className="mx-auto flex w-full max-w-[560px] flex-col md:max-w-none">
      <PainelLinha className="md:flex-1">
        <PainelPrincipal className="gap-4">
      <p className="text-corpo text-tinta-fraca">
        O Kango lê o arquivo inteiro e só cobra o que está nele.
      </p>

      <Segmented
        aria-label="Tipo de material"
        value={aba}
        onValueChange={(v) => setAba(v as Aba)}
        options={[
          { value: "pdf", label: "PDF" },
          { value: "texto", label: "Texto" },
        ]}
      />

      {aba === "pdf" ? (
        <form onSubmit={handlePdfSubmit}>
          <AreaUpload
            titulo={pdfFile ? pdfFile.name : "Escolher PDF"}
            nota={pdfFile ? "Toque em enviar para o Kango ler" : "Do Arquivos, do seu computador ou tirando foto"}
          >
            <input
              ref={inputRef}
              id="pdf-input"
              type="file"
              accept=".pdf"
              className="sr-only"
              onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
            />
            {pdfFile ? (
              <Capsule type="submit" block loading={pdfLoading}>
                {pdfLoading ? "Lendo..." : "Enviar PDF"}
              </Capsule>
            ) : (
              // Cápsula de rótulo: abre o seletor de arquivo sem aninhar
              // <button> dentro de <label>.
              <label
                htmlFor="pdf-input"
                className={cn(
                  // A área de upload ocupa a coluna inteira no computador; a
                  // cápsula dentro dela, não — ver a 56.
                  "md:mx-auto md:w-[260px]",
                  "flex h-capsula-tonal w-full cursor-pointer items-center justify-center rounded-capsula",
                  "bg-indigo text-linha font-semibold text-papel shadow-capsula",
                  "transition-all duration-180 ease-out hover:bg-[hsl(226_57%_32%)] active:scale-[0.98]",
                  "focus-within:shadow-foco-forte"
                )}
              >
                Escolher arquivo
              </label>
            )}
          </AreaUpload>
          {pdfError && <div className="mt-3"><InlineAlert>{pdfError}</InlineAlert></div>}
        </form>
      ) : (
        <form onSubmit={handleTextSubmit} className="flex flex-col gap-4">
          <InsetList superficie="solido">
            <label className="relative flex min-h-linha-campo items-center gap-4 px-4">
              <span className="flex-none text-linha">Nome</span>
              <input
                required
                value={textName}
                onChange={(e) => setTextName(e.target.value)}
                placeholder="Resumo aula 3"
                className="min-w-0 flex-1 bg-transparent text-right text-linha focus:outline-none placeholder:text-borda-forte"
              />
              <span aria-hidden className="pointer-events-none absolute bottom-0 left-4 right-0 h-[0.5px] bg-borda" />
            </label>
            <div className="px-4 py-3">
              <textarea
                required
                rows={6}
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="Cole aqui a anotação, o resumo ou a transcrição da aula."
                className="w-full resize-y bg-transparent text-corpo focus:outline-none placeholder:text-borda-forte"
              />
            </div>
          </InsetList>
          {textError && <InlineAlert>{textError}</InlineAlert>}
          <Capsule type="submit" block loading={textLoading}>
            {textLoading ? "Lendo..." : "Salvar texto"}
          </Capsule>
        </form>
      )}

      {deleteError && <InlineAlert>{deleteError}</InlineAlert>}

      <div className="mt-1.5">
        {loadingList && !lendo ? (
          <>
            <p className="mb-2 px-rotulo-secao text-rotulo uppercase text-tinta-fraca">
              O que o Kango já leu
            </p>
            <Skeleton className="h-[120px] rounded-grupo" />
          </>
        ) : listError ? (
          <InlineAlert>{listError}</InlineAlert>
        ) : documents.length === 0 && !lendo ? (
          <p className="px-rotulo-secao text-nota text-tinta-fraca">
            O Kango ainda não leu nada desta matéria. Envie a apostila, um resumo ou uma prova antiga
            para ele poder cobrar.
          </p>
        ) : (
          <InsetList
            label="O que o Kango já leu"
            footnote="As questões saem só desses materiais, nada que o seu professor não passou."
          >
            {lendo && (
              <InsetRow
                active
                altura="dupla"
                icon={<Loader2 className="animate-spin" />}
                iconTone="indigo"
                title={lendo}
                subtitle={<span className="text-indigo">Lendo o arquivo...</span>}
              />
            )}
            {documents.map((doc: DocumentItem) => (
              <InsetRow
                key={doc.id}
                altura="dupla"
                icon={doc.type === "pdf" ? <FileText /> : <Type />}
                title={doc.name}
                subtitle={
                  <>
                    {doc.type === "pdf" ? "PDF" : "Texto"} ·{" "}
                    <MetricText tone="fraca">
                      {new Date(doc.created_at).toLocaleDateString("pt-BR")}
                    </MetricText>
                  </>
                }
                trailing={
                  <button
                    type="button"
                    onClick={() => handleDelete(doc.id)}
                    disabled={deletingId === doc.id}
                    aria-label={`Apagar ${doc.name}`}
                    className={cn(
                      "flex h-toque w-toque items-center justify-center rounded-capsula text-erro",
                      "transition-colors duration-140 ease-out hover:bg-erro/12",
                      "focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-foco-forte",
                      "disabled:opacity-50"
                    )}
                  >
                    {deletingId === doc.id ? (
                      <Loader2 className="h-[17px] w-[17px] animate-spin" />
                    ) : (
                      <Trash2 className="h-[17px] w-[17px]" />
                    )}
                  </button>
                }
              />
            ))}
          </InsetList>
        )}
      </div>

      {/*
        Atualizar a trilha — a ação que fecha o ciclo de subir material.

        Mora aqui, na coluna principal logo abaixo do que o Kango leu, e não na
        auxiliar: no celular a auxiliar é o ÚLTIMO bloco da pilha (ver
        components/layout/Painel.tsx), então o botão ficava embaixo do upload,
        da lista inteira e do bloco teal — invisível na prática para quem acabou
        de subir um PDF. É a ação mais importante desta tela; ela não pode
        depender de rolar até o fim.

        Continua sendo um botão, e não automático depois do upload: reorganizar
        a trilha é uma chamada de IA, e disparar isso sozinho a cada arquivo
        gastaria à toa em quem sobe três PDFs seguidos.
      */}
      {documents.length > 0 && (
        <div className="mt-1.5 rounded-grupo bg-indigo/10 p-4">
          <p className="flex items-center gap-[7px] text-[11px] font-semibold uppercase tracking-[0.06em] text-indigo">
            <Sparkles className="h-3.5 w-3.5" />
            Trilha da matéria
          </p>
          <p className="mt-1.5 text-pretty text-corpo leading-[1.5] text-tinta">
            {nCapitulos === 0 ? (
              "O Kango ainda não organizou este material em capítulos. Monte a trilha para começar a estudar em ordem."
            ) : precisaAtualizarTrilha ? (
              <>
                <strong className="font-semibold">Material novo esperando.</strong> A trilha ainda
                tem <MetricText weight="bold">{nCapitulos}</MetricText>{" "}
                {nCapitulos === 1 ? "capítulo" : "capítulos"} e não muda sozinha — o que você acabou
                de enviar só vira quiz depois de entrar nela.
              </>
            ) : (
              <>
                A trilha tem{" "}
                <MetricText weight="bold">{nCapitulos}</MetricText>{" "}
                {nCapitulos === 1 ? "capítulo" : "capítulos"}. Subiu material novo? Ela não muda
                sozinha — o Kango lê o que chegou e acrescenta só o que ainda não está coberto.
              </>
            )}
          </p>

          {updateError && (
            <div className="mt-3">
              <InlineAlert>{updateError}</InlineAlert>
            </div>
          )}

          {novosCapitulos !== null && !updateError && (
            <p className="mt-3 flex items-start gap-[7px] text-corpo leading-[1.45] text-acerto">
              <Check className="mt-[3px] h-4 w-4 flex-none" strokeWidth={3} />
              {novosCapitulos === 0 ? (
                <span>
                  Nada novo pra acrescentar — o material que você subiu já está coberto pelos{" "}
                  <MetricText tone="acerto" weight="bold">{nCapitulos}</MetricText> capítulos.
                </span>
              ) : (
                <span>
                  <MetricText tone="acerto" weight="bold">+{novosCapitulos}</MetricText>{" "}
                  {novosCapitulos === 1 ? "capítulo novo" : "capítulos novos"} na trilha.
                </span>
              )}
            </p>
          )}

          <div className="mt-3.5 flex flex-col gap-2 md:flex-row md:items-center">
            <Capsule
              block
              className="md:w-fit"
              loading={updatingModules}
              onClick={handleUpdateTrilha}
            >
              {updatingModules
                ? "Lendo o material..."
                : nCapitulos === 0
                  ? "Montar trilha"
                  : "Atualizar trilha"}
            </Capsule>
            {/* Um livro leva ~30s para ser lido. Sem dizer isso, o botão parado
                em "Lendo o material..." parece travado e a pessoa recarrega a
                página no meio. */}
            {updatingModules && (
              <p className="text-nota text-tinta-fraca md:self-center">
                Pode levar até um minuto em material grande. Fique nesta tela.
              </p>
            )}
            {novosCapitulos !== null && novosCapitulos > 0 && (
              <Link
                href={`/professor/${professorId}`}
                className={capsuleVariants("secundaria", true, "md:w-fit")}
              >
                Ver a trilha
              </Link>
            )}
          </div>
        </div>
      )}
        </PainelPrincipal>

        <PainelAuxiliar largura={400} className="mt-4 md:mt-0">
          {/* A promessa central do produto, escrita onde ela é decidida: é
              nesta tela que a pessoa escolhe o que o Kango pode cobrar. Teal
              porque não é alerta nem acerto — é garantia. */}
          <div className="rounded-grupo bg-teal-700/10 p-[18px] shadow-[inset_0_0_0_1px_rgba(15,118,110,.18)]">
            <p className="flex items-center gap-[7px] text-[11px] font-semibold uppercase tracking-[0.06em] text-teal-700">
              <ShieldCheck className="h-3.5 w-3.5" />
              Só o que está aqui vira questão
            </p>
            <p className="mt-2 text-pretty text-corpo leading-[1.5] text-tinta">
              Se um assunto não está nesses arquivos, o Kango diz que não sabe em vez de inventar.
            </p>
          </div>

          {/* Tópicos que ele tirou daqui: são os dos módulos, que é a leitura
              que o Kango fez do material. Sem módulos gerados a seção some, em
              vez de mostrar uma lista vazia prometendo algo. */}
          {topicos.length > 0 && (
            <div>
              <p className="mb-2 px-4 text-rotulo uppercase text-tinta-fraca">
                Tópicos que ele tirou daqui
              </p>
              <InsetList
                footnote={
                  <>
                    <MetricText tone="fraca">{topicos.length}</MetricText>{" "}
                    {topicos.length === 1 ? "tópico encontrado" : "tópicos encontrados"} no material
                    desta matéria.
                  </>
                }
              >
                {topicos.slice(0, 8).map((t) => (
                  <InsetRow key={t} title={<MathText>{t}</MathText>} />
                ))}
              </InsetList>
            </div>
          )}
        </PainelAuxiliar>
      </PainelLinha>
    </div>
  );
}
