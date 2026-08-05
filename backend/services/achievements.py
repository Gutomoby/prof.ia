"""
Conquistas — as medalhas da tela 34.

DERIVADAS, não gravadas. Não há tabela `achievements`, e é decisão, não
pendência: toda conquista do design é uma pergunta sobre o histórico que já
está no banco ("houve 7 dias seguidos?", "houve quiz com 100%?"), e histórico
não muda. Uma tabela só acrescentaria uma segunda versão da verdade, que
precisaria ser escrita na hora certa em todo caminho que mexe em atividade,
material ou sequência — e que sairia errada para quem já usava o app antes
dela existir.

O custo é recalcular a cada leitura. Com o volume de um aluno (dezenas de
tentativas), é uma varredura em memória.

Cada conquista devolve o mesmo formato:

    id       casa com o catálogo de copy do frontend
    ganha    bool
    data     o dia em que foi ganha (não "hoje"), ou None
    atual    onde a pessoa está, na unidade do alvo
    alvo     onde precisa chegar

A data é sempre o momento em que o critério foi cumprido pela primeira vez,
reconstruído do histórico — não a data em que a conquista passou a existir no
app. Quem já tinha 7 dias seguidos em julho ganhou "Semana cheia" em julho.
"""

from datetime import date, timedelta
from uuid import UUID

from services.scoring import (
    MASTERY_THRESHOLD_PCT,
    MIN_QUESTIONS_FOR_MASTERY,
    answered_activities,
    compute_streak,
    correct_questions,
    to_local_date,
)
from services.supabase_client import get_supabase

# Sete, não nove. O handoff escreve "4 de 9" no cabeçalho, mas nomeia sete —
# as outras duas não existem em lugar nenhum do pacote de design. Inventar
# nome e critério para fechar o número seria inventar produto; o contador
# mostra o que existe.
SEMANA_CHEIA = "semana-cheia"
DUAS_SEMANAS = "duas-semanas"
TRES_DOMINADOS = "tres-dominados"
SEM_ERRO = "sem-erro"
KANGO_ALFABETIZADO = "kango-alfabetizado"
COMBO_10 = "combo-10"
MATERIA_FECHADA = "materia-fechada"

DIAS_SEMANA_CHEIA = 7
DIAS_DUAS_SEMANAS = 14
TOPICOS_TRES_DOMINADOS = 3
MATERIAIS_ALFABETIZADO = 3
ACERTOS_COMBO = 10


def _conquista(id_: str, alvo: int, atual: int, data: date | None) -> dict:
    return {
        "id": id_,
        "ganha": data is not None,
        "data": data,
        # O progresso nunca passa o alvo: "12 de 10 acertos" confunde mais do
        # que informa, e depois de ganha a barra não tem mais o que medir.
        "atual": min(atual, alvo),
        "alvo": alvo,
    }


def _dia_da_sequencia(dias: set[date], n: int) -> date | None:
    """O dia em que uma sequência de `n` dias seguidos se completou, se houve.

    Percorre as corridas de dias consecutivos em ordem; a primeira que alcança
    `n` devolve o seu n-ésimo dia — que é quando a medalha foi ganha, não o
    último dia da corrida.
    """
    for dia in sorted(dias):
        if dia - timedelta(days=1) in dias:
            continue  # não é começo de corrida
        comprimento = 0
        cursor = dia
        while cursor in dias:
            comprimento += 1
            if comprimento == n:
                return cursor
            cursor += timedelta(days=1)
    return None


def _acertos_seguidos(tentativas: list[dict]) -> tuple[int, date | None]:
    """Maior sequência de acertos e o dia em que ela chegou a ACERTOS_COMBO.

    A contagem atravessa tentativas, em ordem cronológica: o combo do produto
    é de ACERTOS, não de "acertos dentro do mesmo quiz". Contar só dentro de
    uma tentativa deixaria a medalha inalcançável, já que quiz de tópico tem
    5 a 8 questões (routers/atividades.py).
    """
    maior = 0
    corrida = 0
    data_ganha: date | None = None

    for tentativa in tentativas:
        corrigidas, _ = correct_questions(tentativa["questions"], tentativa["answers"] or {})
        for questao in corrigidas:
            if questao["correta"]:
                corrida += 1
                maior = max(maior, corrida)
                if corrida == ACERTOS_COMBO and data_ganha is None:
                    data_ganha = to_local_date(tentativa["created_at"])
            else:
                corrida = 0

    return maior, data_ganha


def _dominados_ao_longo(tentativas: list[dict]):
    """Para cada tentativa, o conjunto de tópicos dominados DEPOIS dela.

    Acumula em memória em vez de chamar topic_stats a cada ponto: mesma regra
    (>=70% com no mínimo 2 questões), uma passada só.
    """
    totais: dict[str, dict[str, int]] = {}
    for tentativa in tentativas:
        corrigidas, _ = correct_questions(tentativa["questions"], tentativa["answers"] or {})
        for questao in corrigidas:
            topico = questao.get("topico") or "Geral"
            balde = totais.setdefault(topico, {"n": 0, "certas": 0})
            balde["n"] += 1
            if questao["correta"]:
                balde["certas"] += 1

        dominados = {
            topico
            for topico, balde in totais.items()
            if balde["n"] >= MIN_QUESTIONS_FOR_MASTERY
            and (balde["certas"] / balde["n"]) * 100 >= MASTERY_THRESHOLD_PCT
        }
        yield to_local_date(tentativa["created_at"]), dominados


def conquistas_do_usuario(user_id: str) -> list[dict]:
    sb = get_supabase()

    professores = (
        sb.table("professors").select("id").eq("user_id", user_id).execute().data or []
    )
    ids = [UUID(p["id"]) for p in professores]

    # ---- histórico, uma leitura por matéria -------------------------------
    tentativas_por_materia: dict[UUID, list[dict]] = {
        pid: answered_activities(pid) for pid in ids
    }
    todas_tentativas = sorted(
        (t for lista in tentativas_por_materia.values() for t in lista),
        key=lambda t: t["created_at"],
    )

    documentos = (
        sb.table("documents")
        .select("professor_id, created_at")
        .in_("professor_id", [str(i) for i in ids])
        .order("created_at")
        .execute()
        .data
        or []
    ) if ids else []

    modulos = (
        sb.table("modules")
        .select("professor_id, topics")
        .in_("professor_id", [str(i) for i in ids])
        .execute()
        .data
        or []
    ) if ids else []

    # ---- sequência --------------------------------------------------------
    # Material indexado também conta como dia estudado, igual à sequência de
    # services/progress.py: o dia em que a pessoa só subiu apostila não é dia
    # perdido.
    dias = {to_local_date(t["created_at"]) for t in todas_tentativas}
    dias |= {to_local_date(d["created_at"]) for d in documentos}
    sequencia_atual = compute_streak(sorted(dias))

    # ---- por matéria: dominados e tópicos do material ---------------------
    topicos_do_material: dict[str, set[str]] = {}
    for modulo in modulos:
        topicos_do_material.setdefault(modulo["professor_id"], set()).update(
            modulo.get("topics") or []
        )

    melhor_dominados = 0
    data_tres_dominados: date | None = None
    melhor_fechada = (0, 0)  # (dominados do material, total do material)
    data_materia_fechada: date | None = None

    for pid, tentativas in tentativas_por_materia.items():
        do_material = topicos_do_material.get(str(pid), set())

        for dia, dominados in _dominados_ao_longo(tentativas):
            if len(dominados) > melhor_dominados:
                melhor_dominados = len(dominados)
            if len(dominados) >= TOPICOS_TRES_DOMINADOS and data_tres_dominados is None:
                data_tres_dominados = dia

            # "Matéria fechada" precisa saber quantos tópicos a matéria TEM, e
            # quem sabe isso são os módulos. Sem módulos gerados não há
            # denominador, e a conquista fica de fora dessa matéria em vez de
            # se dar por cumprida com o que apareceu nos quizzes.
            if do_material:
                fechados = len(dominados & do_material)
                if (fechados, -len(do_material)) > (melhor_fechada[0], -melhor_fechada[1]):
                    melhor_fechada = (fechados, len(do_material))
                if fechados == len(do_material) and data_materia_fechada is None:
                    data_materia_fechada = dia

    # ---- quiz sem erro ----------------------------------------------------
    data_sem_erro: date | None = None
    melhor_score = 0
    for tentativa in todas_tentativas:
        score = tentativa.get("score_pct") or 0
        melhor_score = max(melhor_score, int(score))
        if score >= 100 and data_sem_erro is None:
            data_sem_erro = to_local_date(tentativa["created_at"])

    # ---- materiais por matéria -------------------------------------------
    por_materia: dict[str, list[str]] = {}
    for doc in documentos:
        por_materia.setdefault(doc["professor_id"], []).append(doc["created_at"])

    melhor_materiais = max((len(v) for v in por_materia.values()), default=0)
    data_alfabetizado: date | None = None
    for datas in por_materia.values():
        if len(datas) >= MATERIAIS_ALFABETIZADO:
            candidata = to_local_date(sorted(datas)[MATERIAIS_ALFABETIZADO - 1])
            if data_alfabetizado is None or candidata < data_alfabetizado:
                data_alfabetizado = candidata

    # ---- combo ------------------------------------------------------------
    maior_combo, data_combo = _acertos_seguidos(todas_tentativas)

    return [
        _conquista(
            SEMANA_CHEIA,
            DIAS_SEMANA_CHEIA,
            sequencia_atual,
            _dia_da_sequencia(dias, DIAS_SEMANA_CHEIA),
        ),
        _conquista(
            DUAS_SEMANAS,
            DIAS_DUAS_SEMANAS,
            sequencia_atual,
            _dia_da_sequencia(dias, DIAS_DUAS_SEMANAS),
        ),
        _conquista(TRES_DOMINADOS, TOPICOS_TRES_DOMINADOS, melhor_dominados, data_tres_dominados),
        _conquista(SEM_ERRO, 100, melhor_score, data_sem_erro),
        _conquista(
            KANGO_ALFABETIZADO, MATERIAIS_ALFABETIZADO, melhor_materiais, data_alfabetizado
        ),
        _conquista(COMBO_10, ACERTOS_COMBO, maior_combo, data_combo),
        # O alvo desta muda por matéria (é o tamanho do material), então ela
        # devolve o par da matéria mais próxima de fechar.
        _conquista(
            MATERIA_FECHADA,
            melhor_fechada[1] or 1,
            melhor_fechada[0],
            data_materia_fechada,
        ),
    ]
