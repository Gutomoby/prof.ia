"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { PassoMateria, type DadosMateria } from "@/components/onboarding/PassoMateria";
import { PassoMaterial, type DadosMaterial } from "@/components/onboarding/PassoMaterial";
import { PassoLendo } from "@/components/onboarding/PassoLendo";
import { PassoNotificacoes, podePedirNotificacao } from "@/components/onboarding/PassoNotificacoes";
import { PassoPronto } from "@/components/onboarding/PassoPronto";
import { usePrimeiroAcesso } from "@/components/onboarding/usePrimeiroAcesso";
import type { Professor } from "@/lib/types";

/*
  Primeiro acesso, telas 06 a 10, num fluxo só.

  Cinco telas e um estado, em vez de cinco rotas: cada passo depende do
  anterior (o upload precisa do professor recém-criado, o resumo precisa da
  contagem que veio do upload) e nenhuma delas se sustenta se você chegar
  direto pela URL. Rota separada só para a 11, que é o resultado do
  diagnóstico e existe sozinha.

  Voltar do passo 2 para o 1 EDITA o professor em vez de criar outro — é o
  motivo de a tela 06 aceitar valores iniciais.
*/

type Passo = "materia" | "material" | "lendo" | "notificacoes" | "pronto";

function dataBR(iso: string) {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

export default function ComecarPage() {
  const router = useRouter();

  const [passo, setPasso] = useState<Passo>("materia");
  const [professor, setProfessor] = useState<Professor | null>(null);
  const [dadosMateria, setDadosMateria] = useState<DadosMateria | null>(null);
  // Evento de prova no calendário. Guardado para não duplicar quando a pessoa
  // volta ao passo 1 e troca a data.
  const [eventoProvaId, setEventoProvaId] = useState<string | null>(null);

  const [salvandoMateria, setSalvandoMateria] = useState(false);
  const [erroMateria, setErroMateria] = useState<string | null>(null);

  const [nomeArquivo, setNomeArquivo] = useState("");
  const [etapaLeitura, setEtapaLeitura] = useState<"lendo" | "organizando">("lendo");
  const [topicos, setTopicos] = useState<string[]>([]);
  const [nArquivos, setNArquivos] = useState(0);
  const [erroMaterial, setErroMaterial] = useState<string | null>(null);

  const [notificacoes, setNotificacoes] = useState<NotificationPermission | null>(null);
  const [gerandoDiagnostico, setGerandoDiagnostico] = useState(false);

  // O fluxo guiado é da PRIMEIRA matéria. Quem já tem uma cai no formulário
  // da tela 15, que é a porta de "mais uma matéria" — inclusive quem volta
  // para cá pelo histórico depois de terminar.
  const checando = usePrimeiroAcesso({ destino: "/professor/novo", ativo: professor === null });

  async function salvarMateria(dados: DadosMateria) {
    setErroMateria(null);
    setSalvandoMateria(true);

    const examDates = dados.dataProva ? `Prova em ${dataBR(dados.dataProva)}` : null;

    try {
      const p = professor
        ? await api.updateProfessor(professor.id, {
            name: dados.nomeProfessor,
            discipline: dados.discipline,
            exam_dates: examDates,
          })
        : await api.createProfessor({
            name: dados.nomeProfessor,
            discipline: dados.discipline,
            teaching_style: null,
            exam_dates: examDates,
          });

      // exam_dates é texto livre que vai no system_prompt; o calendário
      // (tela 32) lê a tabela de eventos, que é outra coisa. Para a data
      // aparecer nos dois lugares, ela vira também um evento de prova.
      if (eventoProvaId) {
        await api.deleteEvent(eventoProvaId).catch(() => {});
        setEventoProvaId(null);
      }
      if (dados.dataProva) {
        try {
          const evento = await api.createEvent({
            title: `Prova de ${dados.discipline}`,
            kind: "prova",
            event_date: dados.dataProva,
            professor_id: p.id,
          });
          setEventoProvaId(evento.id);
        } catch {
          // A matéria existe e a data está no professor. Falhar o calendário
          // não é motivo para parar o primeiro acesso.
        }
      }

      setProfessor(p);
      setDadosMateria(dados);
      setPasso("material");
    } catch (err) {
      setErroMateria(err instanceof ApiError ? err.message : "Não foi possível criar a matéria.");
    } finally {
      setSalvandoMateria(false);
    }
  }

  async function enviarMaterial(dados: DadosMaterial) {
    if (!professor) return;

    setErroMaterial(null);
    setTopicos([]);
    setNomeArquivo(dados.tipo === "pdf" ? dados.file?.name ?? "" : dados.nome ?? "");
    setEtapaLeitura("lendo");
    setPasso("lendo");

    try {
      if (dados.tipo === "pdf" && dados.file) {
        await api.uploadPdf(professor.id, dados.file);
      } else {
        await api.uploadText({
          professor_id: professor.id,
          name: dados.nome ?? "Texto",
          raw_text: dados.texto ?? "",
        });
      }
      setNArquivos((n) => n + 1);
    } catch (err) {
      setErroMaterial(
        err instanceof ApiError ? err.message : "Não foi possível ler esse material."
      );
      setPasso("material");
      return;
    }

    // Os módulos são o que dá nome aos tópicos da matéria. Se a organização
    // falhar, o material já está indexado e o fluxo segue sem a lista.
    setEtapaLeitura("organizando");
    try {
      const { items } = await api.generateModules(professor.id);
      setTopicos([...new Set(items.flatMap((m) => m.topics))]);
    } catch {
      setTopicos([]);
    }

    setPasso(podePedirNotificacao() ? "notificacoes" : "pronto");
  }

  function sairParaSala() {
    if (!professor) return;
    router.push(`/professor/${professor.id}`);
    router.refresh();
  }

  function comecarDiagnostico() {
    if (!professor) return;
    setGerandoDiagnostico(true);
    // A lição inteira (gerar, responder, corrigir) já existe em /licao/[id].
    // O diagnóstico é ela sem tópico — o quiz sai do material inteiro — e com
    // a volta apontando para a tela 11 em vez do resultado padrão.
    router.push(`/licao/${professor.id}?diagnostico=1`);
  }

  // Nada de tela enquanto a guarda não responde: além de não piscar o
  // formulário para quem vai ser redirecionado, é o que garante que ninguém
  // crie matéria antes de a checagem terminar.
  if (checando) return null;

  if (passo === "materia") {
    return (
      <PassoMateria
        inicial={dadosMateria}
        onVoltar={() => router.push("/boas-vindas")}
        onContinuar={salvarMateria}
        enviando={salvandoMateria}
        erro={erroMateria}
      />
    );
  }

  if (passo === "material") {
    return (
      <PassoMaterial
        onVoltar={() => setPasso("materia")}
        onEnviar={enviarMaterial}
        onPular={sairParaSala}
        erro={erroMaterial}
      />
    );
  }

  if (passo === "lendo") {
    return <PassoLendo nomeArquivo={nomeArquivo} etapa={etapaLeitura} topicos={topicos} />;
  }

  if (passo === "notificacoes") {
    return (
      <PassoNotificacoes
        onResolver={() => {
          setNotificacoes(
            typeof Notification !== "undefined" ? Notification.permission : null
          );
          setPasso("pronto");
        }}
      />
    );
  }

  if (passo === "pronto" && professor) {
    return (
      <PassoPronto
        professor={professor}
        nArquivos={nArquivos}
        nTopicos={topicos.length}
        notificacoes={
          notificacoes ?? (typeof Notification !== "undefined" ? Notification.permission : null)
        }
        onDiagnostico={comecarDiagnostico}
        onDepois={sairParaSala}
        gerando={gerandoDiagnostico}
      />
    );
  }

  return null;
}
