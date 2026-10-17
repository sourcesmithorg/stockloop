"""Test harness: isolated Postgres database, fixture seed, session-scoped client.

The session-scoped `client` is auto-authenticated as the seeded fixture owner
(`owner@stockloop.test`) against the seeded store, so the existing 55 tests that
call operational endpoints keep working. Tests that need the unauthenticated
behaviour spin up a fresh TestClient via `unauth_client` or log out in-process.
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

# Prepare the environment before any app import; real env beats .env (override=False).
os.environ.setdefault("SECRET_KEY", "test-secret-not-for-production")
os.environ.setdefault("ENVIRONMENT", "test")
os.environ["DATABASE_URL"] = (
    "postgresql+asyncpg://stockloop:change-me-locally@localhost:5433/stockloop_test"
)
os.environ["STOCKLOOP_TODAY"] = "2026-10-13"
os.environ.pop("GEMINI_API_KEY", None)
os.environ.pop("GOOGLE_CLOUD_PROJECT", None)
# AI gateway env never reaches tests: provider selection is monkeypatched.
os.environ.pop("NINEROUTER_URL", None)
os.environ.pop("NINEROUTER_API_KEY", None)
os.environ.pop("AI_MODEL", None)

if TYPE_CHECKING:
    from fastapi.testclient import TestClient

FIXTURE_TODAY = "2026-10-13"
API_DIR = Path(__file__).resolve().parent.parent
TEST_DB_NAME = "stockloop_test"


def _recreate_database() -> None:
    import asyncpg

    base = (
        os.environ["DATABASE_URL"]
        .replace("postgresql+asyncpg://", "postgresql://")
        .rsplit("/", 1)[0]
    )
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
        env={**os.environ, "DATABASE_URL": os.environ["DATABASE_URL"]},
        check=True,
        capture_output=True,
    )


def _login(client: TestClient, email: str, password: str) -> TestClient:
    """Authenticate an existing user; the TestClient persists the session cookie."""
    resp = client.post("/api/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200, resp.text
    return client


@pytest.fixture(scope="session")
def client() -> Generator[TestClient, None, None]:
    _recreate_database()
    _upgrade_schema()

    # Seed the fixture store + the demo owner account the session depends on.
    from app.seed import (
        FIXTURE_OWNER_EMAIL,
        FIXTURE_OWNER_PASSWORD,
    )
    from app.seed import (
        run as seed_run,
    )

    asyncio.run(seed_run(os.environ["DATABASE_URL"]))

    from fastapi.testclient import TestClient

    from app.main import create_app

    # Fresh app per client: lifespan builds an engine in this client's own loop.
    with TestClient(create_app()) as test_client:
        _login(test_client, FIXTURE_OWNER_EMAIL, FIXTURE_OWNER_PASSWORD)
        yield test_client


@pytest.fixture()
def unauth_client() -> Generator[TestClient, None, None]:
    """A TestClient with no session cookie — for 401/403 assertions."""
    from fastapi.testclient import TestClient

    from app.main import create_app

    with TestClient(create_app()) as c:
        yield c


def _add_member(store_id: str, email: str, role: str, password: str = "Member123!"):
    """Helper to insert a non-owner membership for a store (used by role tests)."""
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.models import Membership, Preference, User
    from app.services.auth import hash_password

    async def run() -> None:
        engine = create_async_engine(os.environ["DATABASE_URL"])
        try:
            factory = async_sessionmaker(engine, expire_on_commit=False)
            async with factory() as session:
                user = (
                    (await session.execute(select(User).where(User.email == email)))
                    .scalars()
                    .first()
                )
                if user is None:
                    user = User(id=str(uuid4()), email=email, password_hash=hash_password(password))
                    session.add(user)
                    await session.flush()
                membership = await session.get(Membership, (store_id, user.id))
                if membership is None:
                    membership = Membership(
                        store_id=store_id, user_id=user.id, role=role, version=1
                    )
                    session.add(membership)
                else:
                    membership.role = role
                pref = await session.get(Preference, (store_id, user.id))
                if pref is None:
                    session.add(Preference(store_id=store_id, user_id=user.id, version=1))
                await session.commit()
        finally:
            await engine.dispose()

    asyncio.run(run())
    return email, password


@pytest.fixture()
def viewer_client(client: TestClient) -> Generator[TestClient, None, None]:
    """A second TestClient logged in as a viewer of the seeded store."""
    from fastapi.testclient import TestClient

    from app.main import create_app
    from app.seed import STORE_ID

    email, password = _add_member(STORE_ID, "viewer@stockloop.test", "viewer")
    with TestClient(create_app()) as c:
        _login(c, email, password)
        yield c


@pytest.fixture()
def operator_client(client: TestClient) -> Generator[TestClient, None, None]:
    """A TestClient logged in as an operator of the seeded store."""
    from fastapi.testclient import TestClient as TC

    from app.main import create_app
    from app.seed import STORE_ID

    email, password = _add_member(STORE_ID, f"op-{uuid4().hex[:8]}@stockloop.test", "operator")
    with TC(create_app()) as c:
        _login(c, email, password)
        yield c


@pytest.fixture()
def fresh_plan_id() -> str:
    """A brand-new unapproved plan, independent of the seeded one (test isolation)."""
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.models import Store
    from app.seed import FIXTURE_TODAY as seed_today
    from app.seed import STORE_ID
    from app.services.plans import build_plan

    async def build() -> str:
        engine = create_async_engine(os.environ["DATABASE_URL"])
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
