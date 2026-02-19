# Stage 1: Build Frontend
FROM node:20-alpine AS frontend
WORKDIR /build

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY . .
ENV NEXT_PUBLIC_API_URL=""
RUN npm run build

# Verify out/ was created (output: "export" in next.config.ts)
RUN ls -la /build/out/ && echo "✓ Frontend build OK"

# Stage 2: Python Runtime
FROM python:3.11-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY bot/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY bot/ /app/bot/

# Copy static frontend from Stage 1
COPY --from=frontend /build/out /app/static

WORKDIR /app/bot

EXPOSE 80
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "80"]
