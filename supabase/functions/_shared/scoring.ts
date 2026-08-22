/*
  Correção de atividades e métricas agregadas — porta de services/scoring.py.

  Usado pela rota de atividades (correção de uma tentativa) e pela de score
  (agregação de todas as tentativas de um professor).
*/

import { db, selectAll } from "./db.ts";
import { paraDataLocal, hojeLocal, somarDias } from "./tempo.ts";

// Corte de "domínio" por tópico — mesmo critério visual do Badge de score no
// histórico do quiz (verde >=70%).
export const MASTERY_THRESHOLD_PCT = 70.0;
export const MIN_QUESTIONS_FOR_MASTERY = 2;

export type Questao = {
  topico?: string;
  enunciado: string;
  alternativas: string[];
  resposta_correta: number;
  explicacao?: string;
};

export type QuestaoCorrigida = Questao & {
  resposta_usuario: number | null;
  correta: boolean;
};

/** Cruza as respostas do usuário com o gabarito. */
export function corrigirQuestoes(
  questoes: Questao[],
  respostas: Record<string, unknown>,
): { corrigidas: QuestaoCorrigida[]; scorePct: number } {
  const corrigidas: QuestaoCorrigida[] = [];
  let nCertas = 0;

  questoes.forEach((q, idx) => {
    const bruta = respostas?.[String(idx)];
    const respostaUsuario = typeof bruta === "number" ? bruta : null;
    const correta = respostaUsuario === q.resposta_correta;
    if (correta) nCertas++;
    corrigidas.push({ ...q, resposta_usuario: respostaUsuario, correta });
  });

  const scorePct = questoes.length
    ? Math.round((nCertas / questoes.length) * 1000) / 10
    : 0;
  return { corrigidas, scorePct };
}

export type TentativaRespondida = {
  questions: Questao[];
  answers: Record<string, unknown> | null;
  score_pct: number;
  created_at: string;
};

/*
  Tentativas de quiz já respondidas de um professor, mais antigas primeiro.

  `comQuestoes: false` deixa de fora o JSONB questions/answers, que carrega
  enunciado, alternativas e explicação de cada questão. Quem só quer data e
  nota (sequência, gráfico de evolução) não deve pagar por isso: é a coluna
  mais pesada da tabela e cresce a cada quiz respondido.
*/
export async function atividadesRespondidas(
  professorId: string,
  opcoes: { antesDe?: string; comQuestoes?: boolean } = {},
): Promise<TentativaRespondida[]> {
  const { antesDe, comQuestoes = true } = opcoes;
  const colunas = comQuestoes
    ? "questions, answers, score_pct, created_at"
    : "score_pct, created_at";

  return await selectAll<TentativaRespondida>((de, ate) => {
    let q = db()
      .from("activity_results")
      .select(colunas)
      .eq("professor_id", professorId)
      .eq("activity_type", "quiz")
      .not("score_pct", "is", null);
    if (antesDe) q = q.lt("created_at", antesDe);
    return q.order("created_at").range(de, ate);
  });
}

export type StatTopico = {
  topico: string;
  n_questions: number;
  accuracy_pct: number;
  status: "dominado" | "pendente";
};

/*
  Acerto agregado por tópico, juntando questões de todas as tentativas.

  Cada questão tem seu próprio `topico` (atribuído pela IA na geração) —
  diferente do `topic` da atividade, que é só o que o usuário digitou.
*/
export function statsPorTopico(atividades: TentativaRespondida[]): StatTopico[] {
  const totais = new Map<string, { n: number; certas: number }>();

  for (const atividade of atividades) {
    const { corrigidas } = corrigirQuestoes(atividade.questions ?? [], atividade.answers ?? {});
    for (const q of corrigidas) {
      const topico = q.topico || "Geral";
      const balde = totais.get(topico) ?? { n: 0, certas: 0 };
      balde.n++;
      if (q.correta) balde.certas++;
      totais.set(topico, balde);
    }
  }

  const stats: StatTopico[] = [];
  for (const [topico, balde] of totais) {
    const accuracyPct = Math.round((balde.certas / balde.n) * 1000) / 10;
    const dominado = accuracyPct >= MASTERY_THRESHOLD_PCT && balde.n >= MIN_QUESTIONS_FOR_MASTERY;
    stats.push({
      topico,
      n_questions: balde.n,
      accuracy_pct: accuracyPct,
      status: dominado ? "dominado" : "pendente",
    });
  }
  stats.sort((a, b) => a.accuracy_pct - b.accuracy_pct);
  return stats;
}

export async function statsPorTopicoDe(professorId: string, antesDe?: string): Promise<StatTopico[]> {
  return statsPorTopico(await atividadesRespondidas(professorId, { antesDe }));
}

/*
  Dias consecutivos de atividade terminando hoje ou ontem.

  Se o aluno ainda não estudou hoje mas estudou ontem, a sequência continua
  viva (mesma lógica do Duolingo — só quebra depois de pular um dia inteiro).
*/
export function calcularStreak(datas: string[]): number {
  if (!datas.length) return 0;

  const unicas = new Set(datas);
  const hoje = hojeLocal();
  const ancora = unicas.has(hoje) ? hoje : somarDias(hoje, -1);
  if (!unicas.has(ancora)) return 0;

  let streak = 0;
  let cursor = ancora;
  while (unicas.has(cursor)) {
    streak++;
    cursor = somarDias(cursor, -1);
  }
  return streak;
}

export { paraDataLocal, hojeLocal, somarDias };
