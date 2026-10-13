"""Shared request dependencies and error helpers."""

from __future__ import annotations

from datetime import date
from typing import Any

from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db import get_session
from app.models import PurchasingPolicy, Store


def api_error(code: str, message: str, status_code: int, **extra: Any) -> HTTPException:
    """Uniform error envelope: detail = {code, message, ...}."""
    return HTTPException(
        status_code=status_code, detail={"code": code, "message": message, **extra}
    )


def get_today(request: Request) -> date:
    """Server-interpreted today; testable via STOCKLOOP_TODAY (fixture anchor)."""
    return request.app.state.today


async def get_store(
    session: AsyncSession = Depends(get_session),
) -> Store:
    """Trusted store boundary: the store comes from server config, never from the client.

    ponytail: no auth system yet; membership verification lands with authentication.
    """
    settings = get_settings()
    if settings.store_id:
        store = await session.get(Store, settings.store_id)
        if store is None:
            raise api_error("store_not_found", f"Store {settings.store_id} not found", 404)
        return store
    stores = list(
        (
            await session.execute(select(Store).order_by(Store.created_at, Store.id).limit(2))
        ).scalars()
    )
    if not stores:
        raise api_error(
            "store_not_configured", "No store exists yet — run `uv run python -m app.seed`", 503
        )
    if len(stores) > 1:
        raise api_error(
            "store_ambiguous",
            "Multiple stores exist — set STOCKLOOP_STORE_ID to pick one",
            500,
        )
    return stores[0]


async def get_policy(
    session: AsyncSession = Depends(get_session),
    store: Store = Depends(get_store),
) -> PurchasingPolicy:
    policy = await session.get(PurchasingPolicy, store.id)
    if policy is None:
        raise api_error(
            "policy_missing", "Purchasing policy missing — run `uv run python -m app.seed`", 503
        )
    return policy
