"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
    await api.deleteDocument(id);
    await refreshDocuments();
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Configurar material</h2>

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
              {pdfError && <p className="text-sm text-destructive">{pdfError}</p>}
              <Button type="submit" disabled={!pdfFile || pdfLoading}>
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
              {textError && <p className="text-sm text-destructive">{textError}</p>}
              <Button type="submit" disabled={textLoading}>
                {textLoading ? "Salvando..." : "Salvar texto"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Materiais adicionados</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingList && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {listError && <p className="text-sm text-destructive">{listError}</p>}
          {!loadingList && documents.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum material enviado ainda.</p>
          )}
          <ul className="divide-y">
            {documents.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium">{doc.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {doc.type === "pdf" ? "PDF" : "Texto"} ·{" "}
                    {new Date(doc.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <Button variant="ghost" onClick={() => handleDelete(doc.id)}>
                  Excluir
                </Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
