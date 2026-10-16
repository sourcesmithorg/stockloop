"""Authentication: register, login, logout, current session (me).

Session is a signed (stdlib hmac) cookie set/cleared on the Response. The cookie
carries only user_id+store_id(+role hint); load_session_user re-reads membership
so role changes and store scoping are enforced server-side.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.deps import api_error, get_session_user, get_store
from app.models import Membership, Preference, Store, User
from app.schemas import (
    AuthResult,
    LoginRequest,
    MeOut,
    RegisterRequest,
    UserOut,
)
from app.services.auth import (
    SESSION_COOKIE,
    SESSION_MAX_AGE,
    EmailExistsError,
    SessionUser,
    create_session,
    preferences_out,
    register,
    store_out,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _cookie_opts(request: Request) -> dict:
    return {
        "path": "/",
        "max_age": SESSION_MAX_AGE,
        "httponly": True,
        "samesite": "lax",
        "secure": request.app.state.settings.environment == "production",
    }


@router.post("/register", response_model=AuthResult, status_code=status.HTTP_201_CREATED)
async def register_account(
    body: RegisterRequest,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_session),
) -> AuthResult:
    """Create store + owner + preferences + purchasing policy in one transaction."""
    from app.region_data import (
        is_valid_country,
        is_valid_currency,
        is_valid_language,
        is_valid_timezone,
    )

    if not is_valid_country(body.country):
        raise api_error(
            "invalid_country", f"Unknown country code {body.country}", 400, field="country"
        )
    if not is_valid_language(body.language):
        raise api_error(
            "invalid_language", f"Unknown language {body.language}", 400, field="language"
        )
    if not is_valid_currency(body.currency):
        raise api_error(
            "invalid_currency", f"Unknown currency {body.currency}", 400, field="currency"
        )
    if not is_valid_timezone(body.timezone):
        raise api_error(
            "invalid_timezone", f"Unknown timezone {body.timezone}", 400, field="timezone"
        )

    try:
        store, user, preference = await register(
            session,
            email=body.email,
            password=body.password,
            store_name=body.storeName,
            country_code=body.country,
            locale=body.language,
            default_currency=body.currency,
            timezone=body.timezone,
        )
    except EmailExistsError:
        raise api_error(
            "email_exists",
            "An account with this email already exists",
            409,
            field="email",
        ) from None
    await session.commit()

    response.set_cookie(
        SESSION_COOKIE,
        create_session(user, store, "owner", request.app.state.secret_key),
        **_cookie_opts(request),
    )
    return AuthResult(
        user=UserOut(id=user.id, email=user.email, role="owner"),
        store=store_out(store),
        preferences=preferences_out(preference),
    )


@router.post("/login", response_model=AuthResult)
async def login(
    body: LoginRequest,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_session),
) -> AuthResult:
    """Authenticate an existing user and start a signed session."""
    user = (
        (await session.execute(select(User).where(User.email == body.email.strip().lower())))
        .scalars()
        .first()
    )
    # Same message for unknown email / wrong password (no user enumeration).
    if user is None or not verify_password(body.password, user.password_hash):
        raise api_error("invalid_credentials", "Invalid email or password", 401)

    membership = (
        (
            await session.execute(
                select(Membership)
                .where(Membership.user_id == user.id, Membership.status == "active")
                # Newest active membership first: a user invited into another
                # store lands in that store on next login; single-membership
                # users are unaffected. Deterministic, never arbitrary.
                .order_by(Membership.created_at.desc())
            )
        )
        .scalars()
        .first()
    )
    if membership is None:
        raise api_error("invalid_credentials", "Invalid email or password", 401)

    store = await session.get(Store, membership.store_id)
    if store is None:
        raise api_error("invalid_credentials", "Invalid email or password", 401)
    response.set_cookie(
        SESSION_COOKIE,
        create_session(user, store, membership.role, request.app.state.secret_key),
        **_cookie_opts(request),
    )

    pref = await session.get(Preference, (store.id, user.id))
    return AuthResult(
        user=UserOut(id=user.id, email=user.email, role=membership.role),
        store=store_out(store),
        preferences=preferences_out(pref),
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(request: Request, response: Response) -> None:
    """Drop the session cookie (empty 204 response)."""
    opts = _cookie_opts(request)
    response.delete_cookie(
        SESSION_COOKIE,
        path=opts["path"],
        secure=opts["secure"],
        httponly=opts["httponly"],
        samesite=opts["samesite"],
    )


@router.get("/me", response_model=MeOut)
async def me(
    session: AsyncSession = Depends(get_session),
    user: SessionUser = Depends(get_session_user),
    store: Store = Depends(get_store),
) -> MeOut:
    """Authenticated user, their store, preferences and onboarding-completion flag."""
    pref = await session.get(Preference, (store.id, user.user_id))
    return MeOut(
        user=UserOut(id=user.user_id, email=user.email, role=user.role),
        store=store_out(store),
        preferences=preferences_out(pref),
        firstRunComplete=store.first_run_complete,
    )
