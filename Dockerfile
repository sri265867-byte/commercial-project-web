# Stage 1: Build Frontend
FROM node:20-alpine AS build-frontend
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .
# Empty API URL for relative paths (same origin)
ENV NEXT_PUBLIC_API_URL="" 
RUN npm run build

# Stage 2: Build Backend & Runtime
FROM python:3.11-slim
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements
COPY bot/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY bot/ /app/bot/

# Copy frontend build to /app/static
COPY --from=build-frontend /app/out /app/static

# Set workdir to where api.py is
WORKDIR /app/bot

# Expose port (Amvera default)
EXPOSE 80

# Start Uvicorn
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "80"]
