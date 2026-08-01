"use client";

import { useEffect, useState } from "react";
import { FileStack, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { InlineAlert } from "@/components/ui/inline-alert";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { DocumentItem } from "@/lib/types";

export default function ConfigurarPage({ params }: { params: { id: string } }) {
  const professorId = params.id;

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const [textName, setTextName] = useState("");
  const [textContent, setTextContent] = useState("");
  const [textError, setTextError] = useState<string | null>(null);
  const [textLoading, setTextLoading] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professorId]);

  async function handlePdfSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pdfFile) return;
    setPdfError(null);
    setPdfLoading(true);
    try {
      await api.uploadPdf(professorId, pdfFile);
      setPdfFile(null);
      const input = document.getElementById("pdf-input") as HTMLInputElement | null;
      if (input) input.value = "";
      await refreshDocuments();
    } catch (err) {
      setPdfError(err instanceof ApiError ? err.message : "Falha ao enviar o PDF.");
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
    } catch (err) {
      setTextError(err instanceof ApiError ? err.message : "Falha ao salvar o texto.");
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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Adicionar PDF</CardTitle>
            <CardDescription>O texto é extraído e indexado automaticamente.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePdfSubmit} className="space-y-4">
              <Input
                id="pdf-input"
                type="file"
                accept=".pdf"
                onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
              />
              {pdfError && <InlineAlert>{pdfError}</InlineAlert>}
              <Button type="submit" disabled={!pdfFile} loading={pdfLoading}>
                {pdfLoading ? "Enviando..." : "Enviar PDF"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Adicionar texto</CardTitle>
            <CardDescription>Cole anotações, resumos ou transcrições.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleTextSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="text-name">Nome</Label>
                <Input
                  id="text-name"
                  required
                  placeholder="Ex.: Resumo aula 3"
                  value={textName}
                  onChange={(e) => setTextName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="text-content">Conteúdo</Label>
                <Textarea
                  id="text-content"
                  required
                  rows={5}
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                />
              </div>
              {textError && <InlineAlert>{textError}</InlineAlert>}
              <Button type="submit" loading={textLoading}>
                {textLoading ? "Salvando..." : "Salvar texto"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Materiais adicionados</h2>

        {loadingList && (
          <div className="space-y-2">
            <Skeleton className="h-14 rounded-xl" />
            <Skeleton className="h-14 rounded-xl" />
          </div>
        )}

        {!loadingList && listError && <InlineAlert>{listError}</InlineAlert>}
        {deleteError && <InlineAlert>{deleteError}</InlineAlert>}

        {!loadingList && !listError && documents.length === 0 && (
          <Card>
            <EmptyState
              icon={FileStack}
              title="Nenhum material enviado ainda"
              description="Envie um PDF ou cole um texto acima para o quiz poder usar esse conteúdo."
            />
          </Card>
        )}

        {!loadingList &&
          !listError &&
          documents.length > 0 &&
          documents.map((doc) => (
            <Card key={doc.id}>
              <div className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-medium">{doc.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {doc.type === "pdf" ? "PDF" : "Texto"} · {new Date(doc.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(doc.id)}
                  loading={deletingId === doc.id}
                  aria-label={`Excluir ${doc.name}`}
                >
                  {deletingId !== doc.id && <Trash2 className="h-4 w-4" />}
                </Button>
              </div>
            </Card>
          ))}
      </div>

    </div>
  );
}
