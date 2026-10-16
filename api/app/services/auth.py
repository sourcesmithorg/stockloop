"""Auth service: password hashing, registration transaction, session payloads.

Auth is intentionally kept OUT of app/domain/ (the deterministic-logic seam stays
auth-free). This layer owns credentials, identity and the session user view that
the FastAPI dependency layer consumes.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import json
import secrets
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal
from typing import Literal
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Membership, Preference, PurchasingPolicy, Store, StoreBudget, User

# --------------------------------------------------------------------------- roles
# Proposed-implemented (docs/decisions/D-04.md). Stored as a string on membership.
Role = Literal["owner", "operator", "viewer"]
ROLES: tuple[Role, ...] = ("owner", "operator", "viewer")

# Default purchasing policy for a freshly registered store so the plan engine has
# a baseline before an operator tunes Settings.
DEFAULT_POLICY_VERSION = "default-v1"
DEFAULT_POLICY: dict[str, int | str] = {
    "demand_window_days": 13,
    "target_days": 7,
    "safety_days": 2,
    "freshness_days": 7,
    "policy_version": DEFAULT_POLICY_VERSION,
}
DEFAULT_BUDGET_AMOUNT = Decimal("500.00")

# scrypt parameters (RFC 7914). Conservative, ~50-100ms locally; stdlib-only, no
# extra dependency (passlib present transitively but not declared as a dep).
_SCRYPT = {"n": 1 << 15, "r": 8, "p": 1, "maxmem": 128 * 1024 * 1024, "dklen": 32}


# --------------------------------------------------------------------------- passwords
def hash_password(password: str) -> str:
    """scrypt-hashed password. Format: scrypt$<salt_hex>$<hash_hex>."""
    salt = secrets.token_bytes(16)
    dk = hashlib.scrypt(password.encode("utf-8"), salt=salt, **_SCRYPT)
    return f"scrypt${salt.hex()}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    """Constant-time verify of a scrypt hash. Returns False on any parse error."""
    try:
        algo, salt_hex, hash_hex = stored.split("$")
    except ValueError:
        return False
    if algo != "scrypt":
        return False
    try:
        salt = __import__("binascii").unhexlify(salt_hex)
        expected = __import__("binascii").unhexlify(hash_hex)
    except (binascii.Error, ValueError):
        return False
    dk = hashlib.scrypt(password.encode("utf-8"), salt=salt, **_SCRYPT)
    return hmac.compare_digest(dk, expected)


# --------------------------------------------------------------------------- registration
class AuthError(Exception):
    """Base for registration/login failures surfaced as HTTP errors."""


class EmailExistsError(AuthError):
    pass


async def register(
    session: AsyncSession,
    *,
    email: str,
    password: str,
    store_name: str,
    country_code: str,
    locale: str,
    default_currency: str,
    timezone: str,
) -> tuple[Store, User, Preference]:
    """Create store + user + owner membership + blank preferences + default policy,
    atomically (single flush). Raises EmailExistsError on collision.

    Preferences are intentionally all-null: an honest "follow store", never
    coerced to a default. Unknown values stay null everywhere.
    """
    email_norm = email.strip().lower()
    existing = (
        (await session.execute(select(User).where(User.email == email_norm))).scalars().first()
    )
    if existing is not None:
        raise EmailExistsError(email_norm)

    now = datetime.now(UTC)
    store = Store(
        id=str(uuid4()),
        name=store_name,
        country_code=country_code,
        locale=locale,
        default_currency=default_currency,
        timezone=timezone,
        version=1,
        document_seq=0,
        created_at=now,
    )
    user = User(
        id=str(uuid4()),
        email=email_norm,
        password_hash=hash_password(password),
        created_at=now,
    )
    session.add_all([store, user])
    await session.flush()
    session.add_all(
        [
            Membership(
                store_id=store.id,
                user_id=user.id,
                role="owner",
                status="active",
                version=1,
                created_at=now,
            ),
            Preference(store_id=store.id, user_id=user.id, version=1),
            PurchasingPolicy(
                store_id=store.id,
                demand_window_days=DEFAULT_POLICY["demand_window_days"],
                target_days=DEFAULT_POLICY["target_days"],
                safety_days=DEFAULT_POLICY["safety_days"],
                freshness_days=DEFAULT_POLICY["freshness_days"],
                policy_version=DEFAULT_POLICY["policy_version"],
                version=1,
            ),
            StoreBudget(store_id=store.id, currency=default_currency, amount=DEFAULT_BUDGET_AMOUNT),
        ]
    )
    await session.flush()
    preference = (
        (await session.execute(select(Preference).where(Preference.user_id == user.id)))
        .scalars()
        .one()
    )
    return store, user, preference


# --------------------------------------------------------------------------- session
# Signed cookie: stdlib hmac (TimestampSigner-style). No itsdangerous dependency
# (it is NOT a transitive dep of starlette 1.8 in this env) and no SessionMiddleware
# coupling of HttpOnly/Secure. Value = base64url(payload).signature.
SESSION_COOKIE = "session"
SESSION_MAX_AGE = 30 * 24 * 3600  # 30 days
_PAYLOAD_FIELDS = frozenset({"user_id", "store_id", "role", "exp"})


def _b64u(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _unb64u(s: str) -> bytes:
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)


def sign_session(payload: dict, secret: str) -> str:
    body = _b64u(json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8"))
    sig = hmac.new(secret.encode("utf-8"), body.encode("ascii"), hashlib.sha256).hexdigest()
    return f"{body}.{sig}"


def verify_session(cookie_value: str | None, secret: str) -> dict | None:
    """Return the payload if the signature is valid and not expired, else None."""
    if not cookie_value or "." not in cookie_value:
        return None
    body, sig = cookie_value.rsplit(".", 1)
    expected = hmac.new(secret.encode("utf-8"), body.encode("ascii"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(sig, expected):
        return None
    try:
        payload = json.loads(_unb64u(body))
    except (ValueError, KeyError):
        return None
    if not isinstance(payload, dict) or not _PAYLOAD_FIELDS.issuperset(payload):
        return None
    exp = payload.get("exp")
    if not isinstance(exp, (int, float)) or time.time() > exp + SESSION_MAX_AGE:
        return None
    return payload


def create_session(user: User, store: Store, role: str, secret: str) -> str:
    """Build the signed session cookie value for a logged-in user."""
    payload = {
        "user_id": user.id,
        "store_id": store.id,
        "role": role,
        "exp": int(time.time()),
    }
    return sign_session(payload, secret)


@dataclass
class SessionUser:
    user_id: str
    email: str
    store_id: str
    role: str


async def load_session_user(
    session: AsyncSession, cookie_value: str | None, secret: str
) -> SessionUser | None:
    """Resolve the authenticated user from the signed session cookie.

    The cookie carries only user_id + store_id(+role as a hint). Membership is
    re-read from the DB so role changes take effect immediately and store_id is
    validated server-side (client store id alone is never sufficient).
    """
    payload = verify_session(cookie_value, secret)
    if payload is None:
        return None
    user_id = payload.get("user_id")
    store_id = payload.get("store_id")
    if not isinstance(user_id, str) or not isinstance(store_id, str):
        return None
    membership = await session.get(Membership, (store_id, user_id))
    if membership is None or membership.status != "active":
        return None
    user = await session.get(User, user_id)
    if user is None:
        return None
    return SessionUser(user_id=user.id, email=user.email, store_id=store_id, role=membership.role)


from app.schemas import PreferencesOut, StoreOut  # noqa: E402  (avoid cycle: schemas is auth-free)


def store_out(store: Store) -> StoreOut:
    return StoreOut(
        id=store.id,
        name=store.name,
        countryCode=store.country_code,
        locale=store.locale,
        defaultCurrency=store.default_currency,
        timezone=store.timezone,
        version=store.version,
        firstRunComplete=store.first_run_complete,
    )


def preferences_out(pref: Preference | None) -> PreferencesOut:
    if pref is None:
        return PreferencesOut(
            locale=None,
            displayCurrency=None,
            timezone=None,
            dateFormat=None,
            numberFormat=None,
            version=1,
        )
    return PreferencesOut(
        locale=pref.locale,
        displayCurrency=pref.display_currency,
        timezone=pref.timezone,
        dateFormat=pref.date_format,
        numberFormat=pref.number_format,
        version=pref.version,
    )
