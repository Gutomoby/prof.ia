"""
Extração de texto de PDFs com PyMuPDF (fitz).

Para PDFs escaneados (imagem) o resultado virá vazio — nesse caso o caller
deve avisar o usuário. OCR fica fora do MVP.
"""

import fitz  # PyMuPDF


def extract_text(file_bytes: bytes) -> str:
    """Recebe os bytes de um PDF e devolve todo o texto, página a página.

    Páginas são separadas por "\n\n" para preservar quebras lógicas — isso
    ajuda o chunker a evitar misturar conteúdo entre páginas distantes.
    """
    # `stream=` lê de memória (sem precisar de arquivo no disco).
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    try:
        pages_text = [page.get_text("text") for page in doc]
    finally:
        doc.close()

    # Remove páginas totalmente vazias (PDFs costumam ter capas/separadores).
    return "\n\n".join(t for t in pages_text if t.strip())
