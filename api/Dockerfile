# StockLoop API — runtime image. No .env, no tests, no credentials: config comes
# from the environment at run time (app/config.py).
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

# uv pinned to the authoring-machine version (README: uv 0.11.6).
COPY --from=ghcr.io/astral-sh/uv:0.11.6 /uv /usr/local/bin/uv

# curl is only used by the compose healthcheck against /api/health.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependency layer first so it caches until pyproject/uv.lock change.
# --frozen: uv.lock is authoritative; --no-dev: no pytest/ruff/mypy in runtime.
COPY pyproject.toml uv.lock .python-version ./
RUN uv sync --frozen --no-dev

COPY alembic.ini ./
COPY alembic ./alembic
COPY app ./app
COPY prompts ./prompts

# Make the project venv (uvicorn, alembic, app) the default PATH.
ENV PATH="/app/.venv/bin:$PATH"

RUN useradd --system --create-home --uid 10001 stockloop
USER stockloop

EXPOSE 8080
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
