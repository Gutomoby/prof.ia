FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

ENV PORT=8080
EXPOSE 8080

# --timeout generoso: um PDF grande (centenas de chunks, cada um chamando o
# Gemini) pode levar bem mais que o padrão de 30s do gunicorn.
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--timeout", "540", "--workers", "1", "main:app"]
