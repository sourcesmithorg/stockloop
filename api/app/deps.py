"""Shared request dependencies and error helpers.

Authentication boundary: the store is resolved from the signed session cookie
(via app.services.auth.load_session_user), never from a client-supplied id.
Operational routers depend on get_store, so they inherit 401/403 enforcement.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import date
from typing import Any

from fastapi import Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db import get_session
from app.models import PurchasingPolicy, Store
from app.services.auth import SessionUser, load_session_user


def api_error(code: str, message: str, status_code: int, **extra: Any) -> HTTPException:
    """Uniform error envelope: detail = {code, message, ...}."""
    return HTTPException(
        status_code=status_code, detail={"code": code, "message": message, **extra}
    )


def get_today(request: Request) -> date:
    """Server-interpreted today; testable via STOCKLOOP_TODAY (fixture anchor)."""
    return request.app.state.today


async def get_session_user(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> SessionUser:
    """Authenticated user from the signed session cookie. 401 when absent/invalid."""
    settings = get_settings()
    cookie = request.cookies.get("session")
    user = await load_session_user(session, cookie, settings.secret_key)
    if user is None:
        raise api_error("unauthenticated", "Authentication required", 401)
    return user


async def get_store(
    user: SessionUser = Depends(get_session_user),
    session: AsyncSession = Depends(get_session),
) -> Store:
    """Store bound to the authenticated session user's membership.

    The store id is trusted because it is validated against a real membership row
    (see load_session_user). Client-supplied store ids are never sufficient.
    Cross-store reads of a foreign record return 404 (handled at each lookup).
    """
    store = await session.get(Store, user.store_id)
    if store is None:
        raise api_error("store_not_found", "Store not found", 404)
    return store


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


def require_role(*allowed: str) -> Callable[..., SessionUser]:
    """Dependency: raise 403 unless the session user's role is in `allowed`.

    Owner is always admitted (least-privilege callers pass the lowest role).
    Reads are open to authenticated users of the store (viewer included); use
    this on mutating endpoints only.
    """

    def checker(user: SessionUser = Depends(get_session_user)) -> SessionUser:
        if user.role != "owner" and user.role not in allowed:
            raise api_error(
                "forbidden",
                f"Role '{user.role}' cannot perform this action",
                403,
                allowed=list(allowed),
            )
        return user

    return checker
