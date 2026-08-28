FROM python:3.11-slim

WORKDIR /app

# Instalar dependencias
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar archivos del bot
COPY . .

# Puerto expuesto para servicios cloud
EXPOSE 8080

CMD ["python", "worker_server.py"]
