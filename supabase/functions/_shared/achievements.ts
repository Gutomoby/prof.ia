/*
  Conquistas — as medalhas da tela 34. Porta de services/achievements.py.

  DERIVADAS, não gravadas: não há tabela `achievements`. Toda conquista é uma
  pergunta sobre o histórico que já está no banco ("houve 7 dias seguidos?",
  "houve quiz com 100%?"), recalculada a cada leitura. Ver o cabeçalho de
  achievements.py para o raciocínio completo por trás disso.
*/

import { db } from "./db.ts";
import {
  MASTERY_THRESHOLD_PCT,
  MIN_QUESTIONS_FOR_MASTERY,
  atividadesRespondidas,
  calcularStreak,
  corrigirQuestoes,
  paraDataLocal,
  type TentativaRespondida,
} from "./scoring.ts";
import { professoresDoUsuario } from "./progresso.ts";

// Sete, não nove — ver nota em achievements.py: as outras duas do handoff não
// têm nome nem critério definidos em lugar nenhum do pacote de design.
const SEMANA_CHEIA = "semana-cheia";
const DUAS_SEMANAS = "duas-semanas";
const TRES_DOMINADOS = "tres-dominados";
const SEM_ERRO = "sem-erro";
const KANGO_ALFABETIZADO = "kango-alfabetizado";
const COMBO_10 = "combo-10";
const MATERIA_FECHADA = "materia-fechada";

const DIAS_SEMANA_CHEIA = 7;
const DIAS_DUAS_SEMANAS = 14;
const TOPICOS_TRES_DOMINADOS = 3;
const MATERIAIS_ALFABETIZADO = 3;
const ACERTOS_COMBO = 10;

export type Achievement = {
  id: string;
  ganha: boolean;
  data: string | null;
  atual: number;
  alvo: number;
};

function conquista(id: string, alvo: number, atual: number, data: string | null): Achievement {
  return {
    id,
    ganha: data !== null,
    data,
    // O progresso nunca passa o alvo: "12 de 10 acertos" confunde mais do que
    // informa, e depois de ganha a barra não tem mais o que medir.
    atual: Math.min(atual, alvo),
    alvo,
  };
}

function somarDiasLocal(dataIso: string, dias: number): string {
  const [a, m, d] = dataIso.split("-").map(Number);
  const base = new Date(Date.UTC(a, m - 1, d));
  base.setUTCDate(base.getUTCDate() + dias);
  return base.toISOString().slice(0, 10);
}

/** O dia em que uma sequência de `n` dias seguidos se completou, se houve. */
function diaDaSequencia(dias: Set<string>, n: number): string | null {
  for (const dia of [...dias].sort()) {
    if (dias.has(somarDiasLocal(dia, -1))) continue; // não é começo de corrida
    let comprimento = 0;
    let cursor = dia;
    while (dias.has(cursor)) {
      comprimento++;
      if (comprimento === n) return cursor;
      cursor = somarDiasLocal(cursor, 1);
    }
  }
  return null;
}

/** Maior sequência de acertos (atravessando tentativas) e o dia em que ela chegou a ACERTOS_COMBO. */
function acertosSeguidos(tentativas: TentativaRespondida[]): [number, string | null] {
  let maior = 0;
  let corrida = 0;
  let dataGanha: string | null = null;

  for (const tentativa of tentativas) {
    const { corrigidas } = corrigirQuestoes(tentativa.questions ?? [], tentativa.answers ?? {});
    for (const questao of corrigidas) {
      if (questao.correta) {
        corrida++;
        maior = Math.max(maior, corrida);
        if (corrida === ACERTOS_COMBO && dataGanha === null) {
          dataGanha = paraDataLocal(tentativa.created_at);
        }
      } else {
        corrida = 0;
      }
    }
  }

  return [maior, dataGanha];
}

/** Para cada tentativa, o conjunto de tópicos dominados DEPOIS dela. */
function dominadosAoLongo(
  tentativas: TentativaRespondida[],
): { dia: string; dominados: Set<string> }[] {
  const totais = new Map<string, { n: number; certas: number }>();
  const resultado: { dia: string; dominados: Set<string> }[] = [];

  for (const tentativa of tentativas) {
    const { corrigidas } = corrigirQuestoes(tentativa.questions ?? [], tentativa.answers ?? {});
    for (const questao of corrigidas) {
      const topico = questao.topico || "Geral";
      const balde = totais.get(topico) ?? { n: 0, certas: 0 };
      balde.n++;
      if (questao.correta) balde.certas++;
      totais.set(topico, balde);
    }

    const dominados = new Set<string>();
    for (const [topico, balde] of totais) {
      if (
        balde.n >= MIN_QUESTIONS_FOR_MASTERY &&
        (balde.certas / balde.n) * 100 >= MASTERY_THRESHOLD_PCT
      ) {
        dominados.add(topico);
      }
    }
    resultado.push({ dia: paraDataLocal(tentativa.created_at), dominados });
  }

  return resultado;
}

function intersectSize(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return n;
}

export async function conquistasDoUsuario(userId: string): Promise<Achievement[]> {
  const ids = await professoresDoUsuario(userId);

  // ---- histórico, uma leitura por matéria ----------------------------------
  const tentativasPorMateria = new Map<string, TentativaRespondida[]>();
  for (const pid of ids) {
    tentativasPorMateria.set(pid, await atividadesRespondidas(pid));
  }
  const todasTentativas = [...tentativasPorMateria.values()]
    .flat()
    .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));

  const documentos = ids.length
    ? ((await db().from("documents").select("professor_id, created_at").in("professor_id", ids).order("created_at")).data ?? [])
    : [];

  const modulos = ids.length
    ? ((await db().from("modules").select("professor_id, topics").in("professor_id", ids)).data ?? [])
    : [];

  // ---- sequência ------------------------------------------------------------
  // Material indexado também conta como dia estudado, igual a services/progress.py.
  const dias = new Set<string>(todasTentativas.map((t) => paraDataLocal(t.created_at)));
  for (const d of documentos) dias.add(paraDataLocal(d.created_at as string));
  const sequenciaAtual = calcularStreak([...dias]);

  // ---- por matéria: dominados e tópicos do material --------------------------
  const topicosDoMaterial = new Map<string, Set<string>>();
  for (const modulo of modulos) {
    const pid = modulo.professor_id as string;
    const atual = topicosDoMaterial.get(pid) ?? new Set<string>();
    for (const t of (modulo.topics as string[]) ?? []) atual.add(t);
    topicosDoMaterial.set(pid, atual);
  }

  let melhorDominados = 0;
  let dataTresDominados: string | null = null;
  let melhorFechada: [number, number] = [0, 0]; // (dominados do material, total do material)
  let dataMateriaFechada: string | null = null;

  for (const [pid, tentativas] of tentativasPorMateria) {
    const doMaterial = topicosDoMaterial.get(pid) ?? new Set<string>();

    for (const { dia, dominados } of dominadosAoLongo(tentativas)) {
      if (dominados.size > melhorDominados) melhorDominados = dominados.size;
      if (dominados.size >= TOPICOS_TRES_DOMINADOS && dataTresDominados === null) {
        dataTresDominados = dia;
      }

      // "Matéria fechada" precisa saber quantos tópicos a matéria TEM, e quem
      // sabe isso são os módulos. Sem módulos gerados não há denominador, e a
      // conquista fica de fora dessa matéria em vez de se dar por cumprida com
      // o que apareceu nos quizzes.
      if (doMaterial.size > 0) {
        const fechados = intersectSize(dominados, doMaterial);
        const melhora =
          fechados > melhorFechada[0] ||
          (fechados === melhorFechada[0] && doMaterial.size < melhorFechada[1]);
        if (melhora) melhorFechada = [fechados, doMaterial.size];
        if (fechados === doMaterial.size && dataMateriaFechada === null) {
          dataMateriaFechada = dia;
        }
      }
    }
  }

  // ---- quiz sem erro ----------------------------------------------------------
  let dataSemErro: string | null = null;
  let melhorScore = 0;
  for (const tentativa of todasTentativas) {
    const score = tentativa.score_pct ?? 0;
    melhorScore = Math.max(melhorScore, Math.trunc(score));
    if (score >= 100 && dataSemErro === null) dataSemErro = paraDataLocal(tentativa.created_at);
  }

  // ---- materiais por matéria ----------------------------------------------------
  const porMateria = new Map<string, string[]>();
  for (const doc of documentos) {
    const pid = doc.professor_id as string;
    const lista = porMateria.get(pid) ?? [];
    lista.push(doc.created_at as string);
    porMateria.set(pid, lista);
  }

  let melhorMateriais = 0;
  for (const lista of porMateria.values()) melhorMateriais = Math.max(melhorMateriais, lista.length);

  let dataAlfabetizado: string | null = null;
  for (const datas of porMateria.values()) {
    if (datas.length >= MATERIAIS_ALFABETIZADO) {
      const candidata = paraDataLocal([...datas].sort()[MATERIAIS_ALFABETIZADO - 1]);
      if (dataAlfabetizado === null || candidata < dataAlfabetizado) dataAlfabetizado = candidata;
    }
  }

  // ---- combo ----------------------------------------------------------------
  const [maiorCombo, dataCombo] = acertosSeguidos(todasTentativas);

  return [
    conquista(SEMANA_CHEIA, DIAS_SEMANA_CHEIA, sequenciaAtual, diaDaSequencia(dias, DIAS_SEMANA_CHEIA)),
    conquista(DUAS_SEMANAS, DIAS_DUAS_SEMANAS, sequenciaAtual, diaDaSequencia(dias, DIAS_DUAS_SEMANAS)),
    conquista(TRES_DOMINADOS, TOPICOS_TRES_DOMINADOS, melhorDominados, dataTresDominados),
    conquista(SEM_ERRO, 100, melhorScore, dataSemErro),
    conquista(KANGO_ALFABETIZADO, MATERIAIS_ALFABETIZADO, melhorMateriais, dataAlfabetizado),
    conquista(COMBO_10, ACERTOS_COMBO, maiorCombo, dataCombo),
    // O alvo desta muda por matéria (é o tamanho do material), então ela
    // devolve o par da matéria mais próxima de fechar.
    conquista(MATERIA_FECHADA, melhorFechada[1] || 1, melhorFechada[0], dataMateriaFechada),
  ];
}
