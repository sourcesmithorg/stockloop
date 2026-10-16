"""Store identity: read and update the authenticated store (optimistic concurrency).

Country / locale / currency / timezone set here do NOT relabel historical
documents — orders keep their original currency (see DATA-CONTRACTS). Changing
country alone never changes currency (T-05).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.deps import api_error, get_session_user, get_store, require_role
from app.models import Preference, Store
from app.schemas import StoreResult, StoreUpdate, StoreWithPreferences
from app.services.auth import SessionUser, preferences_out, store_out

router = APIRouter(prefix="/store", tags=["store"])


@router.get("", response_model=StoreWithPreferences)
async def read_store(
    session: AsyncSession = Depends(get_session),
    user: SessionUser = Depends(get_session_user),
    store: Store = Depends(get_store),
) -> StoreWithPreferences:
    """The authenticated store plus the caller's preferences (read fallback)."""
    pref = await session.get(Preference, (store.id, user.user_id))
    return StoreWithPreferences(store=store_out(store), preferences=preferences_out(pref))


@router.post("", response_model=StoreResult)
async def update_store(
    body: StoreUpdate,
    session: AsyncSession = Depends(get_session),
    user: SessionUser = Depends(get_session_user),
    store: Store = Depends(get_store),
    _role: None = Depends(require_role("operator")),
) -> StoreResult:
    """Update store identity. Operators and owners may edit; viewers cannot (403)."""
    from app.region_data import (
        is_valid_country,
        is_valid_currency,
        is_valid_language,
        is_valid_timezone,
    )

    if body.expectedVersion is not None and body.expectedVersion != store.version:
        raise api_error(
            "version_conflict",
            "Store was modified by another user",
            409,
            currentVersion=store.version,
        )
    if body.country is not None and not is_valid_country(body.country):
        raise api_error(
            "invalid_country", f"Unknown country code {body.country}", 400, field="country"
        )
    if body.locale is not None and not is_valid_language(body.locale):
        raise api_error("invalid_language", f"Unknown language {body.locale}", 400, field="locale")
    if body.defaultCurrency is not None and not is_valid_currency(body.defaultCurrency):
        raise api_error(
            "invalid_currency",
            f"Unknown currency {body.defaultCurrency}",
            400,
            field="defaultCurrency",
        )
    if body.timezone is not None and not is_valid_timezone(body.timezone):
        raise api_error(
            "invalid_timezone", f"Unknown timezone {body.timezone}", 400, field="timezone"
        )
    changed = False
    if body.name is not None:
        store.name = body.name
        changed = True
    if body.country is not None:
        store.country_code = body.country
        changed = True
    if body.locale is not None:
        store.locale = body.locale
        changed = True
    if body.defaultCurrency is not None:
        store.default_currency = body.defaultCurrency
        changed = True
    if body.timezone is not None:
        store.timezone = body.timezone
        changed = True
    if changed:
        store.version += 1
    await session.commit()
    await session.refresh(store)
    return StoreResult(store=store_out(store), version=store.version)
