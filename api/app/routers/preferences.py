"""User preferences for the authenticated store/user (optimistic concurrency).

Unknown values persist as null, never coerced to a default. Store-region changes
do not relabel historical documents; these are display-only overrides.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.deps import api_error, get_session_user
from app.models import Preference
from app.schemas import PreferencesResult, PreferencesUpdate
from app.services.auth import SessionUser, preferences_out

router = APIRouter(prefix="/preferences", tags=["preferences"])


@router.post("", response_model=PreferencesResult)
async def update_preferences(
    body: PreferencesUpdate,
    session: AsyncSession = Depends(get_session),
    user: SessionUser = Depends(get_session_user),
) -> PreferencesResult:
    """Update the caller's display preferences. Unknown fields stay null."""
    pref = await session.get(Preference, (user.store_id, user.user_id))
    if pref is None:
        pref = Preference(store_id=user.store_id, user_id=user.user_id, version=1)
        session.add(pref)
        await session.flush()

    if body.expectedVersion is not None and body.expectedVersion != pref.version:
        raise api_error(
            "version_conflict",
            "Preferences were modified by another user",
            409,
            currentVersion=pref.version,
        )

    changed = False
    if body.locale is not None:
        pref.locale = body.locale
        changed = True
    if body.displayCurrency is not None:
        pref.display_currency = body.displayCurrency
        changed = True
    if body.timezone is not None:
        pref.timezone = body.timezone
        changed = True
    if body.dateFormat is not None:
        pref.date_format = body.dateFormat
        changed = True
    if body.numberFormat is not None:
        pref.number_format = body.numberFormat
        changed = True
    if changed:
        pref.version += 1
    await session.commit()
    await session.refresh(pref)
    return PreferencesResult(preferences=preferences_out(pref), version=pref.version)
