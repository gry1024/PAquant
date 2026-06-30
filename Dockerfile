FROM python:3.11-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONPATH=/app/services/api
ENV PAQUANT_DB_PATH=/tmp/paquant.sqlite3

RUN pip install --no-cache-dir uv

COPY pyproject.toml uv.lock .python-version README.md ./
RUN uv sync --frozen --no-dev

COPY services/api ./services/api

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "paquant.api.app:create_app", "--factory", "--app-dir", "services/api", "--host", "0.0.0.0", "--port", "8000"]
