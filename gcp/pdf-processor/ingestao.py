"""
Ingestão RESUMÍVEL de documentos (extração -> chunking -> embeddings -> chunks).

Por que existe, em vez do laço simples que ficava em main.py:

  1. Falha no meio apagava tudo. Um único 429 do Gemini derrubava o upload
     inteiro, a compensação apagava o documento e os milhares de embeddings já
     pagos iam junto — e a próxima tentativa recomeçava do zero e batia no mesmo
     limite. Aqui a falha deixa o progresso no banco e a próxima execução
     continua de onde parou (chunks gravados por upsert em (document_id,
     chunk_index), então reprocessar nunca duplica).
  2. Sem retry nem pausa. O código antigo disparava ~33 chunks/s (~1 milhão de
     tokens por minuto) sem espaçar nada. Agora há um ritmo adaptativo: sobe a
     pausa quando o Gemini reclama (429) e desce devagar quando está tudo bem.
  3. O motivo do 429 era descartado (raise_for_status joga o corpo fora). Aqui o
     corpo é lido: distingue "limite por minuto" (espera e tenta de novo) de
     "cota diária esgotada" (não adianta insistir — falha rápido, com mensagem).
  4. A chave do Gemini aparecia nos logs (vinha na URL da requisição e o httpx
     a repete na mensagem de erro). A chave agora vai no header, e nenhuma
     exceção de rede é repassada com a URL.

Este módulo não importa httpx/supabase/fitz: tudo que toca o mundo externo
chega por parâmetro. É isso que permite testar com cliente de mentira
(test_ingestao.py) sem gastar cota nem tocar no banco de produção.
"""

from __future__ import annotations

import logging
import random
import re
import threading
import time
from datetime import datetime, timezone
from typing import Callable, Optional

# Chunks por chamada ao Gemini. Eram 64 (~32 mil tokens por chamada). 32 deixa
# cada chamada menor, o que dilui o pico por minuto e perde menos trabalho
# quando uma chamada falha.
LOTE = 32

RETRIES_MAX = 8  # por lote, antes de desistir e marcar o documento como erro
ESPERA_MAX = 60.0  # nunca dorme mais que isso de uma vez (o batimento cobre)
PAUSA_MIN = 0.5  # pausa entre chamadas bem-sucedidas, no melhor caso
PAUSA_INICIAL = 1.0
PAUSA_MAX = 30.0

# Mensagens que o aluno vê (documents.erro). Cada uma termina no próximo passo.
# A de "sem texto" precisa continuar casando com /extrair texto|escaneado/i no
# frontend — é ela que abre a tela 43 ("PDF sem texto").
MSG_SEM_TEXTO = "Não foi possível extrair texto. O PDF pode ser escaneado/imagem."
MSG_COTA_DIARIA = (
    "O Kango atingiu o limite diário de leitura da IA. O progresso foi guardado: "
    "tente de novo mais tarde e a leitura continua de onde parou."
)
MSG_SOBRECARGA = (
    "A IA de leitura está sobrecarregada no momento. O progresso foi guardado: "
    "tente de novo em alguns minutos e a leitura continua de onde parou."
)
MSG_ARQUIVO = "Não foi possível abrir o PDF. O arquivo pode estar corrompido ou protegido por senha."
MSG_DOWNLOAD = "Não foi possível baixar o arquivo enviado. Tente enviar de novo."
MSG_INESPERADO = "Falha inesperada ao ler o arquivo. Tente de novo; se repetir, divida o PDF em partes."


class ErroDeRede(Exception):
    """Falha de transporte (timeout, conexão). A mensagem NUNCA carrega URL."""


class CotaDiariaEsgotada(Exception):
    """O Gemini informou cota DIÁRIA esgotada — insistir agora não adianta."""


class FalhaEmbedding(Exception):
    """Falha de embedding sem conserto por retry (ou retries esgotados)."""


# ---------------------------------------------------------------------------
# Leitura do 429 do Gemini
# ---------------------------------------------------------------------------


def _json_ou_none(resp) -> Optional[dict]:
    try:
        corpo = resp.json()
    except Exception:  # noqa: BLE001 — corpo que não é JSON é só "sem detalhe"
        return None
    return corpo if isinstance(corpo, dict) else None


def _detalhes(corpo: Optional[dict]) -> list[dict]:
    erro = (corpo or {}).get("error") or {}
    detalhes = erro.get("details") or []
    return [d for d in detalhes if isinstance(d, dict)]


def cota_diaria_esgotada(corpo: Optional[dict]) -> bool:
    """Cota por DIA (ex.: EmbedContentRequestsPerDayPerProjectPerModel-FreeTier).

    Em docs/migracao-supabase.md está o histórico: a cota diária do free tier
    já esgotou duas vezes, e esperar minutos não adiantou. O sinal confiável é
    o quotaId do próprio erro; "per day" na mensagem é o plano B.
    """
    for d in _detalhes(corpo):
        for v in d.get("violations") or []:
            quota_id = str((v or {}).get("quotaId", "")).lower()
            if "perday" in quota_id or "per_day" in quota_id:
                return True
    mensagem = str(((corpo or {}).get("error") or {}).get("message", "")).lower()
    return "per day" in mensagem or "daily" in mensagem


_ATRASO = re.compile(r"^\s*([0-9]+(?:\.[0-9]+)?)\s*s\s*$")


def espera_sugerida(resp, corpo: Optional[dict]) -> Optional[float]:
    """Segundos que o servidor pediu para esperar (Retry-After ou RetryInfo)."""
    cabecalho = None
    try:
        cabecalho = resp.headers.get("retry-after") or resp.headers.get("Retry-After")
    except Exception:  # noqa: BLE001
        cabecalho = None
    if cabecalho:
        try:
            return max(0.0, float(cabecalho))
        except ValueError:
            pass
    for d in _detalhes(corpo):
        atraso = d.get("retryDelay")
        if isinstance(atraso, str):
            m = _ATRASO.match(atraso)
            if m:
                return float(m.group(1))
    return None


def resumo_erro(resp, limite: int = 300) -> str:
    """Trecho curto do corpo do erro, para log e mensagem. O corpo de resposta do
    Gemini não repete a chave; a chave só estava na URL da REQUISIÇÃO."""
    corpo = _json_ou_none(resp)
    mensagem = ((corpo or {}).get("error") or {}).get("message")
    texto = str(mensagem if mensagem else getattr(resp, "text", "") or "")
    return texto[:limite]


# ---------------------------------------------------------------------------
# Embeddings com ritmo adaptativo
# ---------------------------------------------------------------------------


class Embedder:
    """Chama o Gemini em lote, com retry e pausa adaptativa.

    `enviar(textos)` faz a requisição HTTP e devolve um objeto com
    status_code / headers / json() / text; falha de transporte vira ErroDeRede.

    Uma instância por processo, compartilhada entre as threads de ingestão: o
    lock serializa as chamadas, então dois PDFs processando ao mesmo tempo
    dividem o mesmo ritmo em vez de somarem rajadas.
    """

    def __init__(
        self,
        enviar: Callable[[list[str]], object],
        dormir: Callable[[float], None] = time.sleep,
        aleatorio: Callable[[], float] = random.random,
    ) -> None:
        self._enviar = enviar
        self._dormir = dormir
        self._aleatorio = aleatorio
        self._lock = threading.Lock()
        self.pausa = PAUSA_INICIAL

    def _backoff(self, tentativa: int) -> float:
        return min(ESPERA_MAX, float(2**tentativa)) + self._aleatorio()

    def _esperar(self, segundos: float, batimento: Optional[Callable[[], None]]) -> None:
        # Bate o coração ANTES de dormir: a espera pode passar de um minuto e o
        # documento não pode parecer parado (parado = worker morto = retomada).
        if batimento:
            batimento()
        self._dormir(min(segundos, ESPERA_MAX))

    def embed(
        self, textos: list[str], batimento: Optional[Callable[[], None]] = None
    ) -> list[list[float]]:
        if not textos:
            return []
        with self._lock:
            return self._embed_travado(textos, batimento)

    def _embed_travado(
        self, textos: list[str], batimento: Optional[Callable[[], None]]
    ) -> list[list[float]]:
        tentativa = 0
        while True:
            try:
                resp = self._enviar(textos)
            except ErroDeRede as exc:
                tentativa += 1
                if tentativa > RETRIES_MAX:
                    raise FalhaEmbedding(f"rede: {exc}") from None
                self._esperar(self._backoff(tentativa), batimento)
                continue

            status = resp.status_code
            if status == 200:
                corpo = _json_ou_none(resp) or {}
                vetores = [e["values"] for e in corpo.get("embeddings", [])]
                # Resposta curta não pode passar: o chamador faz zip(lote,
                # vetores), que trunca em silêncio e gravaria chunks faltando.
                if len(vetores) != len(textos):
                    raise FalhaEmbedding(
                        f"resposta incompleta ({len(vetores)} de {len(textos)} embeddings)"
                    )
                self._sucesso(batimento)
                return vetores

            if status == 429:
                corpo = _json_ou_none(resp)
                logging.warning("gemini 429: %s", resumo_erro(resp))
                if cota_diaria_esgotada(corpo):
                    raise CotaDiariaEsgotada(resumo_erro(resp))
                tentativa += 1
                if tentativa > RETRIES_MAX:
                    raise FalhaEmbedding("limite por minuto persistente (429)")
                espera = espera_sugerida(resp, corpo)
                self.pausa = min(PAUSA_MAX, max(self.pausa * 2, PAUSA_INICIAL))
                self._esperar(espera if espera is not None else self._backoff(tentativa), batimento)
                continue

            if status >= 500:
                tentativa += 1
                logging.warning("gemini %s: %s", status, resumo_erro(resp))
                if tentativa > RETRIES_MAX:
                    raise FalhaEmbedding(f"Gemini indisponível ({status})")
                self._esperar(self._backoff(tentativa), batimento)
                continue

            # 4xx que não é 429 (chave inválida, modelo inexistente...): não
            # tem conserto por tentativa.
            raise FalhaEmbedding(f"Gemini recusou a requisição ({status}): {resumo_erro(resp)}")

    def _sucesso(self, batimento: Optional[Callable[[], None]]) -> None:
        # Espaça as chamadas mesmo sem erro (é o que evita a rajada de ~1M
        # tokens/min) e relaxa devagar a pausa que um 429 anterior tinha subido.
        self._esperar(self.pausa, batimento)
        self.pausa = max(PAUSA_MIN, self.pausa * 0.9)


# ---------------------------------------------------------------------------
# O trabalho em si
# ---------------------------------------------------------------------------


def _agora_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _atualizar(sb, document_id: str, **campos) -> bool:
    """UPDATE em documents. Devolve False se a linha não existe mais — é assim
    que o worker descobre que o aluno apagou o documento no meio da leitura."""
    resp = sb.table("documents").update(campos).eq("id", document_id).execute()
    return bool(resp.data)


def _marcar_erro(sb, document_id: str, mensagem: str) -> None:
    _atualizar(sb, document_id, status="erro", erro=mensagem, heartbeat_at=_agora_iso())


def _proximo_indice(sb, document_id: str) -> int:
    """Primeiro chunk_index ainda não gravado. Os lotes entram em ordem e cada
    upsert é uma instrução só, então os índices gravados são contíguos."""
    resp = (
        sb.table("chunks")
        .select("chunk_index")
        .eq("document_id", document_id)
        .order("chunk_index", desc=True)
        .limit(1)
        .execute()
    )
    linhas = resp.data or []
    return int(linhas[0]["chunk_index"]) + 1 if linhas else 0


def _documento_existe(sb, document_id: str) -> bool:
    resp = sb.table("documents").select("id").eq("id", document_id).limit(1).execute()
    return bool(resp.data)


def processar_documento(
    sb,
    embedder: Embedder,
    *,
    document_id: str,
    professor_id: str,
    storage_path: str,
    bucket: str,
    extrair: Callable[[bytes], str],
    quebrar: Callable[[str], list[str]],
    parar: Optional[threading.Event] = None,
) -> str:
    """Indexa (ou RETOMA) um documento. Devolve um rótulo do desfecho:
    'pronto', 'erro', 'sumiu' (apagado no meio) ou 'interrompido' (SIGTERM).

    Nunca levanta: todo desfecho fica registrado em documents.status/erro, que é
    o que a tela lê. Nunca apaga chunks já gravados — a retomada depende deles.
    """

    def batimento(**extra) -> bool:
        return _atualizar(sb, document_id, heartbeat_at=_agora_iso(), **extra)

    try:
        resp = sb.table("documents").select("raw_text").eq("id", document_id).limit(1).execute()
        linhas = resp.data or []
        if not linhas:
            return "sumiu"
        texto = linhas[0].get("raw_text") or ""

        # Texto já extraído numa execução anterior: pula download + extração, e
        # garante que o chunking dê exatamente os mesmos pedaços de antes.
        if not texto.strip():
            try:
                arquivo = sb.storage.from_(bucket).download(storage_path)
            except Exception:  # noqa: BLE001
                logging.exception("falha_download (document_id=%s)", document_id)
                _marcar_erro(sb, document_id, MSG_DOWNLOAD)
                return "erro"
            try:
                texto = extrair(arquivo)
            except Exception:  # noqa: BLE001
                logging.exception("falha_extracao (document_id=%s)", document_id)
                _marcar_erro(sb, document_id, MSG_ARQUIVO)
                return "erro"
            if not texto.strip():
                _marcar_erro(sb, document_id, MSG_SEM_TEXTO)
                return "erro"
            if not batimento(raw_text=texto):
                return "sumiu"

        chunks = quebrar(texto)
        if not chunks:
            _marcar_erro(sb, document_id, MSG_SEM_TEXTO)
            return "erro"
        total = len(chunks)

        ja_gravados = min(_proximo_indice(sb, document_id), total)
        if not batimento(chunks_total=total, chunks_done=ja_gravados):
            return "sumiu"
        if ja_gravados:
            logging.info(
                "retomando document_id=%s: %d de %d chunks já gravados", document_id, ja_gravados, total
            )

        for inicio in range(ja_gravados, total, LOTE):
            if parar is not None and parar.is_set():
                # Deploy/escala derrubando a instância: o documento continua
                # 'processando' com batimento velho, e a retomada o pega.
                return "interrompido"

            lote = chunks[inicio : inicio + LOTE]
            vetores = embedder.embed(lote, batimento=lambda: batimento())
            sb.table("chunks").upsert(
                [
                    {
                        "professor_id": professor_id,
                        "document_id": document_id,
                        "content": conteudo,
                        "embedding": vetor,
                        "chunk_index": inicio + i,
                    }
                    for i, (conteudo, vetor) in enumerate(zip(lote, vetores))
                ],
                on_conflict="document_id,chunk_index",
            ).execute()
            if not batimento(chunks_done=inicio + len(lote)):
                return "sumiu"

        batimento(status="pronto", chunks_done=total, erro=None)
        logging.info("pronto document_id=%s (%d chunks)", document_id, total)
        return "pronto"

    except CotaDiariaEsgotada as exc:
        logging.error("cota diária do Gemini esgotada (document_id=%s): %s", document_id, exc)
        _marcar_erro(sb, document_id, MSG_COTA_DIARIA)
        return "erro"
    except FalhaEmbedding as exc:
        logging.error("falha_embedding (document_id=%s): %s", document_id, exc)
        _marcar_erro(sb, document_id, MSG_SOBRECARGA)
        return "erro"
    except Exception:  # noqa: BLE001
        logging.exception("falha_indexacao (document_id=%s)", document_id)
        try:
            # Apagado no meio: o upsert estoura na FK. Não é erro de ninguém.
            if not _documento_existe(sb, document_id):
                return "sumiu"
            _marcar_erro(sb, document_id, MSG_INESPERADO)
        except Exception:  # noqa: BLE001
            logging.exception("não foi possível registrar o erro (document_id=%s)", document_id)
        return "erro"
