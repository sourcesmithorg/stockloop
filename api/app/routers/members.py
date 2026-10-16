"""Store membership management (D-04): list, add, change role, revoke.

Management (POST/PATCH/DELETE) is owner-only; the member list is readable by
every member of the store. Scoping is resolved from the session's own store —
a user id from another store resolves to 404 here, never to a mutation.

No email is sent (there is no mail infrastructure and none is authorized):
the add response states plainly that the API recorded the membership and
nobody was contacted.

Revocation flips `membership.status` to "revoked". `load_session_user`
re-reads the membership row on every request and rejects non-active rows, so
a revoked member's still-valid signed cookie stops authorizing immediately
(401) — not merely at next login.
"""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.deps import api_error, get_store, require_role
from app.models import Membership, Store, User
from app.schemas import MemberAddRequest, MemberOut, MemberResult, MemberRoleUpdate
from app.services.auth import ROLES

router = APIRouter(prefix="/store/members", tags=["members"])

_NO_CONTACT = "No email was sent — nobody was contacted; tell them yourself."


def _member_out(membership: Membership, user: User) -> MemberOut:
    return MemberOut(
        id=user.id,
        email=user.email,
        role=membership.role,
        status=membership.status,
        createdAt=membership.created_at,
    )


async def _active_owners(session: AsyncSession, store_id: str) -> list[Membership]:
    result = await session.execute(
        select(Membership)
        .where(
            Membership.store_id == store_id,
            Membership.role == "owner",
            Membership.status == "active",
        )
        # Row locks in a deterministic order: two concurrent demotions of each
        # other serialize instead of both observing "two owners remain".
        .order_by(Membership.created_at.asc())
        .with_for_update()
    )
    return list(result.scalars().all())


@router.get("", response_model=list[MemberOut])
async def list_members(
    session: AsyncSession = Depends(get_session),
    store: Store = Depends(get_store),
) -> list[MemberOut]:
    """Every membership row (active and revoked) of the caller's own store."""
    rows = (
        await session.execute(
            select(Membership, User)
            .join(User, User.id == Membership.user_id)
            .where(Membership.store_id == store.id)
            .order_by(Membership.created_at.asc())
        )
    ).all()
    return [_member_out(membership, user) for membership, user in rows]


@router.post("", response_model=MemberResult, status_code=status.HTTP_201_CREATED)
async def add_member(
    body: MemberAddRequest,
    session: AsyncSession = Depends(get_session),
    store: Store = Depends(get_store),
    _role: None = Depends(require_role()),
) -> MemberResult:
    """Add an existing account (by email) to the store. Owner-only.

    Mechanism (D-04): invite-by-email for an existing account — the smaller
    honest thing. The account must already exist; no pending-invitation table
    and no email delivery are involved.
    """
    if body.role not in ROLES:
        raise api_error(
            "invalid_role",
            f"Unknown role '{body.role}'",
            400,
            field="role",
            allowed=list(ROLES),
        )
    email_norm = body.email.strip().lower()
    user = (await session.execute(select(User).where(User.email == email_norm))).scalars().first()
    if user is None:
        raise api_error(
            "user_not_found",
            f"No account exists for {email_norm} — they must register first",
            404,
            field="email",
        )
    membership = await session.get(Membership, (store.id, user.id))
    if membership is not None and membership.status == "active":
        raise api_error(
            "already_member",
            f"{email_norm} is already a member of this store",
            409,
            field="email",
        )
    now = datetime.now(UTC)
    if membership is None:
        membership = Membership(
            store_id=store.id,
            user_id=user.id,
            role=body.role,
            status="active",
            version=1,
            created_at=now,
        )
        session.add(membership)
    else:
        # Re-adding a revoked member reactivates (single row — never a duplicate).
        membership.role = body.role
        membership.status = "active"
        membership.version += 1
        membership.created_at = now
    await session.commit()
    await session.refresh(membership)
    return MemberResult(
        member=_member_out(membership, user),
        notified=False,
        message=f"Membership recorded for {email_norm}. {_NO_CONTACT}",
    )


@router.patch("/{user_id}", response_model=MemberOut)
async def change_member_role(
    user_id: str,
    body: MemberRoleUpdate,
    session: AsyncSession = Depends(get_session),
    store: Store = Depends(get_store),
    _role: None = Depends(require_role()),
) -> MemberOut:
    """Change a member's role. Owner-only. The last remaining owner cannot be
    demoted (the store must never lose its final owner). Role changes take
    effect on the affected user's next request: sessions re-read the membership.
    """
    if body.role not in ROLES:
        raise api_error(
            "invalid_role",
            f"Unknown role '{body.role}'",
            400,
            field="role",
            allowed=list(ROLES),
        )
    membership = await session.get(Membership, (store.id, user_id))
    if membership is None:
        raise api_error("member_not_found", "Member not found in this store", 404)
    if (
        membership.role == "owner"
        and membership.status == "active"
        and body.role != "owner"
        and len(await _active_owners(session, store.id)) == 1
    ):
        raise api_error(
            "last_owner",
            "This is the last owner of the store — promote another owner before demoting",
            409,
        )
    membership.role = body.role
    membership.version += 1
    await session.commit()
    await session.refresh(membership)
    user = await session.get(User, user_id)
    assert user is not None  # membership FK guarantees the user row
    return _member_out(membership, user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_member(
    user_id: str,
    session: AsyncSession = Depends(get_session),
    store: Store = Depends(get_store),
    _role: None = Depends(require_role()),
) -> None:
    """Revoke a member (status -> "revoked"). Owner-only. The last remaining
    owner cannot be revoked. The revoked member's live session stops being
    authorized on its next request (membership re-read per request)."""
    membership = await session.get(Membership, (store.id, user_id))
    if membership is None:
        raise api_error("member_not_found", "Member not found in this store", 404)
    if (
        membership.role == "owner"
        and membership.status == "active"
        and len(await _active_owners(session, store.id)) == 1
    ):
        raise api_error(
            "last_owner",
            "This is the last owner of the store — promote another owner before revoking",
            409,
        )
    if membership.status != "revoked":
        membership.status = "revoked"
        membership.version += 1
        await session.commit()
