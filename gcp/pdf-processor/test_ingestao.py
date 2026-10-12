"""Testes de ingestao.py com clientes de mentira (sem rede, sem banco, sem cota).

Rodar: python -m unittest test_ingestao -v
"""

import threading
import unittest

import ingestao as ing


class Resp:
    def __init__(self, status=200, corpo=None, headers=None, texto=""):
        self.status_code = status
        self._corpo = corpo
        self.headers = headers or {}
        self.text = texto

    def json(self):
        if self._corpo is None:
            raise ValueError("sem json")
        return self._corpo


def ok(n):
    return Resp(200, {"embeddings": [{"values": [0.1, 0.2]} for _ in range(n)]})


def r429(delay="2s", quota="GenerateRequestsPerMinutePerProjectPerModel"):
    return Resp(
        429,
        {
            "error": {
                "message": "quota",
                "details": [
                    {"violations": [{"quotaId": quota}]},
                    {"retryDelay": delay},
                ],
            }
        },
    )


class Roteiro:
    """enviar() de mentira: devolve respostas na ordem (ou levanta, se for exceção)."""

    def __init__(self, *respostas):
        self.respostas = list(respostas)
        self.chamadas = []

    def __call__(self, textos):
        self.chamadas.append(list(textos))
        item = self.respostas.pop(0) if self.respostas else ok(len(textos))
        if callable(item):
            item = item(textos)
        if isinstance(item, Exception):
            raise item
        return item


def novo_embedder(roteiro):
    sono = []
    e = ing.Embedder(roteiro, dormir=sono.append, aleatorio=lambda: 0.0)
    e.sono = sono
    return e


class TestParsing(unittest.TestCase):
    def test_retry_delay(self):
        r = r429("34s")
        self.assertEqual(ing.espera_sugerida(r, r.json()), 34.0)

    def test_retry_delay_fracionado(self):
        r = r429("1.5s")
        self.assertEqual(ing.espera_sugerida(r, r.json()), 1.5)

    def test_retry_after_header_tem_prioridade(self):
        r = Resp(429, {"error": {}}, headers={"retry-after": "7"})
        self.assertEqual(ing.espera_sugerida(r, r.json()), 7.0)

    def test_sem_sugestao(self):
        r = Resp(429, None)
        self.assertIsNone(ing.espera_sugerida(r, None))

    def test_cota_diaria_por_quota_id(self):
        self.assertTrue(ing.cota_diaria_esgotada(r429(quota="EmbedContentRequestsPerDayPerProjectPerModel-FreeTier").json()))

    def test_cota_por_minuto_nao_e_diaria(self):
        self.assertFalse(ing.cota_diaria_esgotada(r429().json()))

    def test_cota_diaria_por_mensagem(self):
        self.assertTrue(ing.cota_diaria_esgotada({"error": {"message": "You exceeded your daily limit"}}))

    def test_corpo_invalido(self):
        self.assertFalse(ing.cota_diaria_esgotada(None))


class TestEmbedder(unittest.TestCase):
    def test_sucesso_espaca_chamadas(self):
        e = novo_embedder(Roteiro(ok(2)))
        self.assertEqual(len(e.embed(["a", "b"])), 2)
        self.assertEqual(e.sono, [ing.PAUSA_INICIAL])
        self.assertAlmostEqual(e.pausa, ing.PAUSA_INICIAL * 0.9)

    def test_429_por_minuto_respeita_retry_delay_e_tenta_de_novo(self):
        rot = Roteiro(r429("12s"), ok(1))
        e = novo_embedder(rot)
        self.assertEqual(len(e.embed(["a"])), 1)
        self.assertEqual(len(rot.chamadas), 2)
        self.assertEqual(e.sono[0], 12.0)
        self.assertGreater(e.pausa, ing.PAUSA_INICIAL * 0.9)  # pausa subiu

    def test_429_sem_sugestao_usa_backoff(self):
        e = novo_embedder(Roteiro(Resp(429, None), ok(1)))
        e.embed(["a"])
        self.assertEqual(e.sono[0], 2.0)  # 2**1 + aleatorio(0)

    def test_espera_nunca_passa_do_maximo(self):
        e = novo_embedder(Roteiro(r429("600s"), ok(1)))
        e.embed(["a"])
        self.assertEqual(e.sono[0], ing.ESPERA_MAX)

    def test_cota_diaria_falha_rapido_sem_retry(self):
        rot = Roteiro(r429(quota="RequestsPerDay"))
        e = novo_embedder(rot)
        with self.assertRaises(ing.CotaDiariaEsgotada):
            e.embed(["a"])
        self.assertEqual(len(rot.chamadas), 1)
        self.assertEqual(e.sono, [])

    def test_429_persistente_desiste(self):
        e = novo_embedder(Roteiro(*[r429("1s") for _ in range(ing.RETRIES_MAX + 1)]))
        with self.assertRaises(ing.FalhaEmbedding):
            e.embed(["a"])

    def test_5xx_tenta_de_novo(self):
        e = novo_embedder(Roteiro(Resp(503, None), ok(1)))
        self.assertEqual(len(e.embed(["a"])), 1)

    def test_4xx_nao_tenta_de_novo(self):
        rot = Roteiro(Resp(400, {"error": {"message": "API key not valid"}}))
        e = novo_embedder(rot)
        with self.assertRaises(ing.FalhaEmbedding):
            e.embed(["a"])
        self.assertEqual(len(rot.chamadas), 1)

    def test_erro_de_rede_tenta_de_novo(self):
        e = novo_embedder(Roteiro(ing.ErroDeRede("ReadTimeout"), ok(1)))
        self.assertEqual(len(e.embed(["a"])), 1)

    def test_resposta_incompleta_e_falha(self):
        e = novo_embedder(Roteiro(ok(1)))
        with self.assertRaises(ing.FalhaEmbedding):
            e.embed(["a", "b"])

    def test_batimento_antes_de_dormir(self):
        bat = []
        e = novo_embedder(Roteiro(r429("5s"), ok(1)))
        e.embed(["a"], batimento=lambda: bat.append(1))
        self.assertEqual(len(bat), 2)  # antes da espera do 429 e antes da pausa do sucesso


# ----- Supabase de mentira -------------------------------------------------


class Resultado:
    def __init__(self, data):
        self.data = data


class Tabela:
    def __init__(self, banco, nome):
        self.b, self.nome = banco, nome
        self._op = None
        self._filtros = {}
        self._ordem = None
        self._limite = None
        self._campos = None
        self._payload = None

    def select(self, campos="*"):
        self._op, self._campos = "select", campos
        return self

    def update(self, campos):
        self._op, self._payload = "update", campos
        return self

    def upsert(self, linhas, on_conflict=None):
        self._op, self._payload = "upsert", linhas
        return self

    def eq(self, col, val):
        self._filtros[col] = val
        return self

    def order(self, col, desc=False):
        self._ordem = (col, desc)
        return self

    def limit(self, n):
        self._limite = n
        return self

    def execute(self):
        b = self.b
        if self.nome == "documents":
            doc = b.doc if b.doc is not None and b.doc["id"] == self._filtros.get("id") else None
            if self._op == "select":
                return Resultado([dict(doc)] if doc else [])
            if self._op == "update":
                if not doc:
                    return Resultado([])
                doc.update(self._payload)
                b.historico.append(dict(self._payload))
                return Resultado([dict(doc)])
        if self.nome == "chunks":
            if self._op == "upsert":
                if b.doc is None:
                    raise RuntimeError("violates foreign key constraint")
                for l in self._payload:
                    b.chunks[l["chunk_index"]] = l
                b.upserts += 1
                if b.apagar_apos_upserts and b.upserts >= b.apagar_apos_upserts:
                    b.doc = None
                return Resultado(self._payload)
            if self._op == "select":
                if not b.chunks:
                    return Resultado([])
                return Resultado([{"chunk_index": max(b.chunks)}])
        raise AssertionError(f"operação não prevista: {self.nome} {self._op}")


class Banco:
    def __init__(self, raw_text=None, chunks_ja=0):
        self.doc = {"id": "d1", "raw_text": raw_text, "status": "processando"}
        self.chunks = {i: {"chunk_index": i} for i in range(chunks_ja)}
        self.historico = []
        self.upserts = 0
        self.apagar_apos_upserts = 0
        self.downloads = 0
        self.falha_download = False
        outer = self

        class Bucket:
            def download(self, caminho):
                outer.downloads += 1
                if outer.falha_download:
                    raise RuntimeError("boom")
                return b"%PDF"

        class Storage:
            def from_(self, bucket):
                return Bucket()

        self.storage = Storage()

    def table(self, nome):
        return Tabela(self, nome)


def rodar(banco, embedder, texto="x", n_chunks=70, extrair=None, parar=None):
    chunks = [f"c{i}" for i in range(n_chunks)]
    return ing.processar_documento(
        banco,
        embedder,
        document_id="d1",
        professor_id="p1",
        storage_path="p1/a.pdf",
        bucket="materiais",
        extrair=extrair or (lambda _b: texto),
        quebrar=lambda _t: chunks,
        parar=parar,
    )


class TestProcessar(unittest.TestCase):
    def test_caminho_feliz(self):
        b = Banco()
        e = novo_embedder(Roteiro())
        self.assertEqual(rodar(b, e, n_chunks=70), "pronto")
        self.assertEqual(sorted(b.chunks), list(range(70)))
        self.assertEqual(b.doc["status"], "pronto")
        self.assertEqual(b.doc["chunks_done"], 70)
        self.assertEqual(b.doc["chunks_total"], 70)
        self.assertEqual(b.doc["raw_text"], "x")

    def test_429_por_minuto_no_meio_e_concluido(self):
        b = Banco()
        e = novo_embedder(Roteiro(lambda t: ok(len(t)), r429("3s"), lambda t: ok(len(t))))
        self.assertEqual(rodar(b, e, n_chunks=70), "pronto")
        self.assertEqual(len(b.chunks), 70)

    def test_cota_diaria_mantem_progresso_parcial(self):
        b = Banco()
        e = novo_embedder(Roteiro(lambda t: ok(len(t)), r429(quota="RequestsPerDay")))
        self.assertEqual(rodar(b, e, n_chunks=70), "erro")
        self.assertEqual(b.doc["status"], "erro")
        self.assertEqual(b.doc["erro"], ing.MSG_COTA_DIARIA)
        self.assertEqual(len(b.chunks), ing.LOTE)  # primeiro lote ficou
        self.assertEqual(b.doc["chunks_done"], ing.LOTE)

    def test_retoma_de_onde_parou_sem_reextrair(self):
        b = Banco(raw_text="texto ja extraido", chunks_ja=32)
        rot = Roteiro()
        e = novo_embedder(rot)
        extraiu = []
        self.assertEqual(rodar(b, e, n_chunks=70, extrair=lambda _b: extraiu.append(1) or "x"), "pronto")
        self.assertEqual(b.downloads, 0)
        self.assertEqual(extraiu, [])
        self.assertEqual(rot.chamadas[0][0], "c32")  # não refez o que já estava gravado
        self.assertEqual(len(b.chunks), 70)

    def test_sem_texto(self):
        b = Banco()
        self.assertEqual(rodar(b, novo_embedder(Roteiro()), texto="   "), "erro")
        self.assertEqual(b.doc["erro"], ing.MSG_SEM_TEXTO)

    def test_mensagem_sem_texto_casa_com_regex_do_frontend(self):
        import re
        self.assertTrue(re.search(r"extrair texto|escaneado", ing.MSG_SEM_TEXTO, re.I))

    def test_falha_de_download(self):
        b = Banco()
        b.falha_download = True
        self.assertEqual(rodar(b, novo_embedder(Roteiro())), "erro")
        self.assertEqual(b.doc["erro"], ing.MSG_DOWNLOAD)

    def test_falha_de_extracao(self):
        def quebra(_b):
            raise ValueError("pdf ruim")
        b = Banco()
        self.assertEqual(rodar(b, novo_embedder(Roteiro()), extrair=quebra), "erro")
        self.assertEqual(b.doc["erro"], ing.MSG_ARQUIVO)

    def test_documento_apagado_no_meio(self):
        b = Banco()
        b.apagar_apos_upserts = 1
        self.assertEqual(rodar(b, novo_embedder(Roteiro()), n_chunks=70), "sumiu")

    def test_documento_inexistente(self):
        b = Banco()
        b.doc = None
        self.assertEqual(rodar(b, novo_embedder(Roteiro())), "sumiu")

    def test_sigterm_interrompe_sem_marcar_erro(self):
        b = Banco()
        parar = threading.Event()
        parar.set()
        self.assertEqual(rodar(b, novo_embedder(Roteiro()), parar=parar), "interrompido")
        self.assertEqual(b.doc["status"], "processando")

    def test_falha_de_embedding_vira_erro_de_sobrecarga(self):
        b = Banco()
        e = novo_embedder(Roteiro(Resp(400, {"error": {"message": "bad"}})))
        self.assertEqual(rodar(b, e), "erro")
        self.assertEqual(b.doc["erro"], ing.MSG_SOBRECARGA)


if __name__ == "__main__":
    unittest.main()
