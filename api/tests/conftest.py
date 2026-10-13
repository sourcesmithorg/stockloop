"""Test harness: isolated Postgres database, fixture seed, session-scoped client.

Env is prepared before any app import: STOCKLOOP_TODAY pins the fixture date,
DATABASE_URL points at stockloop_test (recreated per session).
"""

from __future__ import annotations

import asyncio
import os
import subprocess
import sys
from collections.abc import Generator
from pathlib import Path
from typing import TYPE_CHECKING
from uuid import uuid4

import pytest

API_DIR = Path(__file__).resolve().parent.parent
TEST_DB_NAME = "stockloop_test"
BASE_DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql+asyncpg://stockloop:change-me-locally@localhost:5433/stockloop"
)
TEST_DATABASE_URL = BASE_DATABASE_URL.rsplit("/", 1)[0] + "/" + TEST_DB_NAME

# Prepare the environment before any app import; real env beats .env (override=False).
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ["STOCKLOOP_TODAY"] = "2026-10-13"
os.environ.pop("GEMINI_API_KEY", None)
os.environ.pop("GOOGLE_CLOUD_PROJECT", None)

if TYPE_CHECKING:
    from fastapi.testclient import TestClient

FIXTURE_TODAY = "2026-10-13"


def _recreate_database() -> None:
    import asyncpg

    base = TEST_DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://").rsplit("/", 1)[0]
    admin_url = base + "/postgres"

    async def recreate() -> None:
        conn = await asyncpg.connect(admin_url)
        try:
            await conn.execute(f"DROP DATABASE IF EXISTS {TEST_DB_NAME} WITH (FORCE)")
            await conn.execute(f"CREATE DATABASE {TEST_DB_NAME}")
        finally:
            await conn.close()

    asyncio.run(recreate())


def _upgrade_schema() -> None:
    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=API_DIR,
        env={**os.environ, "DATABASE_URL": TEST_DATABASE_URL},
        check=True,
        capture_output=True,
    )


@pytest.fixture(scope="session")
def client() -> Generator[TestClient, None, None]:
    _recreate_database()
    _upgrade_schema()

    from app.seed import run as seed_run

    asyncio.run(seed_run(TEST_DATABASE_URL))

    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def fresh_plan_id() -> str:
    """A brand-new unapproved plan, independent of the seeded one (test isolation)."""
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.models import Store
    from app.seed import FIXTURE_TODAY as seed_today
    from app.seed import STORE_ID
    from app.services.plans import build_plan

    async def build() -> str:
        engine = create_async_engine(TEST_DATABASE_URL)
        try:
            factory = async_sessionmaker(engine, expire_on_commit=False)
            async with factory() as session:
                store = await session.get(Store, STORE_ID)
                assert store is not None
                plan = await build_plan(session, store, seed_today, plan_id=str(uuid4()))
                await session.commit()
                return plan.id
        finally:
            await engine.dispose()

    return asyncio.run(build())
