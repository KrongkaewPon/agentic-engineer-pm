FROM node:22-slim AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend /app/frontend
RUN npm run build

FROM python:3.12-slim

WORKDIR /app

RUN pip install --no-cache-dir uv

COPY backend/pyproject.toml /app/backend/pyproject.toml
COPY backend/README.md /app/backend/README.md

WORKDIR /app/backend
RUN uv sync --no-dev

COPY backend /app/backend
COPY --from=frontend-builder /app/frontend/out /app/backend/static

RUN mkdir -p /app/backend/data && useradd -m -u 1000 appuser && chown -R appuser:appuser /app

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/hello')" || exit 1

USER appuser

CMD ["uv", "run", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
