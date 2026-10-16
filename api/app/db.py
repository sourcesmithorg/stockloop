"""Async SQLAlchemy engine/session wiring.

The engine is owned by the app instance and created inside that app's lifespan
event loop, then disposed on shutdown. This keeps each TestClient (which runs its
own loop) fully isolated — a module-global engine would be shared across loops
and asyncpg would raise "attached to a different loop".
"""

from __future__ import annotations

from collections.abc import AsyncIterator

from fastapi import FastAPI, Request
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.config import get_settings


def build_engine() -> AsyncEngine:
    """Create an engine for the current settings (call inside the app's loop)."""
    return create_async_engine(get_settings().database_url, pool_pre_ping=True)


def init_app_state(app: FastAPI) -> None:
    """Attach a fresh engine + session factory to this app instance."""
    engine = build_engine()
    app.state.engine = engine
    app.state.session_factory = async_sessionmaker(engine, expire_on_commit=False)


async def shutdown_app_state(app: FastAPI) -> None:
    engine: AsyncEngine | None = getattr(app.state, "engine", None)
    if engine is not None:
        await engine.dispose()
        app.state.engine = None


async def get_session(request: Request) -> AsyncIterator[AsyncSession]:
    factory: async_sessionmaker[AsyncSession] = request.app.state.session_factory
    session = factory()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()
