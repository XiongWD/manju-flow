# ── Stage 1: Build frontend ──
FROM node:22-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend-next/package*.json ./
RUN npm ci
COPY frontend-next/ .
RUN npx next build

# ── Stage 2: Python runtime ──
FROM python:3.12-slim
WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Python deps
COPY backend/requirements*.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend
COPY backend/ ./backend/
WORKDIR /app/backend

# Copy frontend static output
COPY --from=frontend-builder /app/frontend/.next/standalone ./
COPY --from=frontend-builder /app/frontend/.next/static ./frontend/.next/static
COPY --from=frontend-builder /app/frontend/public ./frontend/public

EXPOSE 8000
ENV PYTHONUNBUFFERED=1
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
