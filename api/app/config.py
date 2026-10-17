"""Environment-backed settings. Defaults mirror .env.example; never commit secrets."""

from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import date
from pathlib import Path

from dotenv import load_dotenv


def _load_dotenv() -> None:
    """Load the nearest .env (cwd or repo root) without overriding real env vars."""
    for candidate in (Path.cwd() / ".env", Path(__file__).resolve().parents[2] / ".env"):
        if candidate.is_file():
            load_dotenv(candidate, override=False)
            return


_load_dotenv()

DEFAULT_DATABASE_URL = "postgresql+asyncpg://stockloop:change-me-locally@localhost:5433/stockloop"
DEFAULT_WEB_ORIGIN = "http://localhost:5173"


@dataclass(frozen=True)
class Settings:
    database_url: str
    web_origins: tuple[str, ...]
    google_cloud_project: str | None
    google_cloud_region: str
    gemini_model: str | None
    store_id: str | None
    # Fixture/demo anchor: when set, the API interprets "today" as this date so the
    # delivered Oct-2026 fixture arithmetic stays reproducible on any machine clock.
    today_override: date | None
    gemini_api_key: str | None
    # 9router gateway (OpenAI-compatible). When the URL is set it takes
    # precedence over the Gemini route for AI calls; the key is optional
    # (omitted only when the gateway runs with auth disabled).
    ninerouter_url: str | None
    ninerouter_api_key: str | None
    ai_model: str
    secret_key: str
    environment: str


def get_settings() -> Settings:
    today_raw = os.environ.get("STOCKLOOP_TODAY") or None
    project = os.environ.get("GOOGLE_CLOUD_PROJECT") or None
    api_key = os.environ.get("GEMINI_API_KEY") or None
    # Default to the gateway's cheapest verified worker; AI_MODEL overrides.
    model = os.environ.get("GEMINI_MODEL") or "gemini-2.5-flash"
    ai_model = os.environ.get("AI_MODEL") or "tiny-worker"
    return Settings(
        database_url=os.environ.get("DATABASE_URL") or DEFAULT_DATABASE_URL,
        web_origins=tuple(
            origin.strip()
            for origin in (os.environ.get("WEB_ORIGIN") or DEFAULT_WEB_ORIGIN).split(",")
            if origin.strip()
        ),
        google_cloud_project=project,
        google_cloud_region=os.environ.get("GOOGLE_CLOUD_REGION") or "us-central1",
        gemini_model=model,
        gemini_api_key=api_key,
        ninerouter_url=os.environ.get("NINEROUTER_URL") or None,
        ninerouter_api_key=os.environ.get("NINEROUTER_API_KEY") or None,
        ai_model=ai_model,
        store_id=os.environ.get("STOCKLOOP_STORE_ID") or None,
        today_override=date.fromisoformat(today_raw) if today_raw else None,
        secret_key=os.environ.get("SECRET_KEY") or "change-me-locally",
        environment=os.environ.get("ENVIRONMENT") or "development",
    )
