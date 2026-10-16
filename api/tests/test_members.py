"""Membership management (M2 / D-04): list, add, role change, revoke, lockout protection.

Every store here is a freshly registered one — the seeded fixture store is never
mutated, so these tests are order-independent.
"""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

PASSWORD = "Member123!pass"


def _register(c: TestClient, email: str, store_name: str = "Test Store") -> dict:
    resp = c.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": PASSWORD,
            "storeName": store_name,
            "country": "US",
            "language": "en",
            "currency": "USD",
            "timezone": "UTC",
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def _email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@stockloop.test"


def _new_client() -> TestClient:
    from fastapi.testclient import TestClient as TC

    from app.main import create_app

    return TC(create_app())


def _open_client() -> TestClient:
    """A started TestClient (lifespan ran, session cookie jar live)."""
    return _new_client().__enter__()


@pytest.fixture()
def owner_a(client: TestClient) -> TestClient:
    """A fresh store ("Store A") with its own owner. `client` guarantees the
    test DB exists (session-scoped recreate + seed)."""
    c = _open_client()
    _register(c, _email("owner-a"), "Store A")
    yield c
    c.close()


def _add_member(owner: TestClient, email: str, role: str = "viewer") -> TestClient:
    """Register a fresh account (which gets its own store) and add it to the
    owner's store; log the member back in so their session targets that store."""
    c = _open_client()
    _register(c, email, "Their Own Store")
    resp = owner.post("/api/store/members", json={"email": email, "role": role})
    assert resp.status_code == 201, resp.text
    login = c.post("/api/auth/login", json={"email": email, "password": PASSWORD})
    assert login.status_code == 200, login.text
    assert login.json()["user"]["role"] == role
    return c


@pytest.fixture()
def member(owner_a: TestClient) -> TestClient:
    c = _add_member(owner_a, _email("member"))
    yield c
    c.close()


def _member_id(owner: TestClient, email: str) -> str:
    members = owner.get("/api/store/members").json()
    matches = [m for m in members if m["email"] == email]
    assert len(matches) == 1, matches
    return matches[0]["id"]


class TestAddAndList:
    def test_added_member_appears_in_list_and_authenticates_into_the_store(
        self, owner_a: TestClient, member: TestClient
    ):
        email = member.get("/api/auth/me").json()["user"]["email"]
        listed = owner_a.get("/api/store/members").json()
        mine = [m for m in listed if m["email"] == email]
        assert len(mine) == 1
        assert mine[0]["role"] == "viewer"
        assert mine[0]["status"] == "active"
        # The member's session is bound to Store A, not their own store.
        store_a = owner_a.get("/api/auth/me").json()["store"]["id"]
        me = member.get("/api/auth/me").json()
        assert me["store"]["id"] == store_a
        assert me["user"]["role"] == "viewer"

    def test_add_is_owner_only_and_open_for_reading(self, owner_a: TestClient):
        viewer = _add_member(owner_a, _email("read-only"))
        assert viewer.get("/api/store/members").status_code == 200
        resp = viewer.post("/api/store/members", json={"email": _email("x"), "role": "viewer"})
        assert resp.status_code == 403, resp.text

    def test_duplicate_add_is_409_and_creates_no_duplicate_row(self, owner_a: TestClient):
        email = _email("dup")
        _add_member(owner_a, email)
        resp = owner_a.post("/api/store/members", json={"email": email, "role": "operator"})
        assert resp.status_code == 409, resp.text
        assert resp.json()["detail"]["code"] == "already_member"
        rows = [m for m in owner_a.get("/api/store/members").json() if m["email"] == email]
        assert len(rows) == 1

    def test_unknown_email_is_404(self, owner_a: TestClient):
        resp = owner_a.post(
            "/api/store/members", json={"email": "ghost@example.test", "role": "viewer"}
        )
        assert resp.status_code == 404, resp.text
        assert resp.json()["detail"]["code"] == "user_not_found"

    def test_invalid_role_is_400(self, owner_a: TestClient):
        resp = owner_a.post("/api/store/members", json={"email": _email("bad"), "role": "admin"})
        assert resp.status_code == 400, resp.text
        assert resp.json()["detail"]["code"] == "invalid_role"

    def test_add_response_states_nobody_was_contacted(self, owner_a: TestClient):
        email = _email("honest")
        with _new_client() as invitee:
            _register(invitee, email, "Invitee Store")
        resp = owner_a.post("/api/store/members", json={"email": email, "role": "viewer"})
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["notified"] is False
        assert "No email was sent" in body["message"]


class TestRoleChange:
    def test_role_change_takes_effect_on_next_request(self, owner_a: TestClient):
        email = _email("promoted-then-demoted")
        op = _add_member(owner_a, email, role="operator")
        user_id = _member_id(owner_a, email)
        # Operator may edit store identity (D-04 matrix).
        assert op.post("/api/store", json={"locale": "en"}).status_code == 200
        resp = owner_a.patch(f"/api/store/members/{user_id}", json={"role": "viewer"})
        assert resp.status_code == 200, resp.text
        assert resp.json()["role"] == "viewer"
        # The same live session is re-scoped on its next request.
        assert op.post("/api/store", json={"locale": "en"}).status_code == 403
        assert op.get("/api/auth/me").json()["user"]["role"] == "viewer"

    def test_member_cannot_escalate_own_role(self, owner_a: TestClient):
        viewer_email = _email("self-escalator")
        viewer = _add_member(owner_a, viewer_email, role="viewer")
        viewer_id = _member_id(owner_a, viewer_email)
        resp = viewer.patch(f"/api/store/members/{viewer_id}", json={"role": "owner"})
        assert resp.status_code == 403, resp.text
        op_email = _email("op-escalator")
        op = _add_member(owner_a, op_email, role="operator")
        op_id = _member_id(owner_a, op_email)
        resp = op.patch(f"/api/store/members/{op_id}", json={"role": "owner"})
        assert resp.status_code == 403, resp.text

    def test_operator_cannot_manage_members(self, owner_a: TestClient):
        target_email = _email("op-target")
        _add_member(owner_a, target_email, role="viewer")
        op = _add_member(owner_a, _email("op-plain"), role="operator")
        target_id = _member_id(owner_a, target_email)
        resp = op.post("/api/store/members", json={"email": _email("n"), "role": "viewer"})
        assert resp.status_code == 403, resp.text
        resp = op.patch(f"/api/store/members/{target_id}", json={"role": "viewer"})
        assert resp.status_code == 403, resp.text
        resp = op.delete(f"/api/store/members/{target_id}")
        assert resp.status_code == 403, resp.text


class TestRevocation:
    def test_revoked_members_session_is_rejected_on_next_use(self, owner_a: TestClient):
        email = _email("revoked")
        member = _add_member(owner_a, email)
        user_id = _member_id(owner_a, email)
        # The session is valid right up to the revoke.
        assert member.get("/api/auth/me").status_code == 200
        stolen_cookie = member.cookies.get("session")
        assert stolen_cookie is not None
        assert owner_a.delete(f"/api/store/members/{user_id}").status_code == 204
        # Same live cookie, next request: rejected. Revocation is immediate.
        assert member.get("/api/auth/me").status_code == 401
        # Even replayed verbatim in a brand-new client the cookie is dead.
        with _new_client() as replay:
            replay.cookies.set("session", stolen_cookie)
            assert replay.get("/api/auth/me").status_code == 401
        listed = [m for m in owner_a.get("/api/store/members").json() if m["email"] == email]
        assert listed[0]["status"] == "revoked"

    def test_revoked_member_can_be_readded_without_duplicate_rows(self, owner_a: TestClient):
        email = _email("revoked-then-readded")
        _add_member(owner_a, email)
        user_id = _member_id(owner_a, email)
        assert owner_a.delete(f"/api/store/members/{user_id}").status_code == 204
        resp = owner_a.post("/api/store/members", json={"email": email, "role": "operator"})
        assert resp.status_code == 201, resp.text
        assert resp.json()["member"]["status"] == "active"
        assert resp.json()["member"]["role"] == "operator"
        rows = [m for m in owner_a.get("/api/store/members").json() if m["email"] == email]
        assert len(rows) == 1


class TestLastOwnerProtection:
    def test_last_owner_cannot_be_demoted_or_revoked(self, owner_a: TestClient):
        owner_id = owner_a.get("/api/auth/me").json()["user"]["id"]
        demote = owner_a.patch(f"/api/store/members/{owner_id}", json={"role": "operator"})
        assert demote.status_code == 409, demote.text
        assert demote.json()["detail"]["code"] == "last_owner"
        revoke = owner_a.delete(f"/api/store/members/{owner_id}")
        assert revoke.status_code == 409, revoke.text
        assert revoke.json()["detail"]["code"] == "last_owner"
        # Still an active owner afterwards.
        assert owner_a.get("/api/auth/me").status_code == 200

    def test_second_owner_allows_demotion_then_protection_moves(self, owner_a: TestClient):
        owner_id = owner_a.get("/api/auth/me").json()["user"]["id"]
        second_email = _email("second-owner")
        _add_member(owner_a, second_email, role="owner")
        second_id = _member_id(owner_a, second_email)
        # Two owners: the first may demote themselves.
        resp = owner_a.patch(f"/api/store/members/{owner_id}", json={"role": "operator"})
        assert resp.status_code == 200, resp.text
        # The demoted owner keeps a valid session but can no longer manage members.
        me = owner_a.get("/api/auth/me")
        assert me.status_code == 200
        assert me.json()["user"]["role"] == "operator"
        resp = owner_a.post("/api/store/members", json={"email": _email("late"), "role": "viewer"})
        assert resp.status_code == 403, resp.text
        # The second owner is now the last one — protection follows them.
        with _new_client() as second:
            login = second.post(
                "/api/auth/login", json={"email": second_email, "password": PASSWORD}
            )
            assert login.status_code == 200, login.text
            demote = second.patch(f"/api/store/members/{second_id}", json={"role": "viewer"})
            assert demote.status_code == 409, demote.text
            assert demote.json()["detail"]["code"] == "last_owner"
            revoke = second.delete(f"/api/store/members/{second_id}")
            assert revoke.status_code == 409, revoke.text


class TestCrossStoreIsolation:
    def test_store_b_owner_cannot_see_or_touch_store_a_members(
        self, owner_a: TestClient, member: TestClient
    ):
        email = member.get("/api/auth/me").json()["user"]["email"]
        member_id = _member_id(owner_a, email)
        with _new_client() as b:
            _register(b, _email("owner-b"), "Store B")
            listed = b.get("/api/store/members").json()
            assert all(m["email"] != email for m in listed)  # Store A's members invisible
            resp = b.patch(f"/api/store/members/{member_id}", json={"role": "owner"})
            assert resp.status_code == 404, resp.text
            resp = b.delete(f"/api/store/members/{member_id}")
            assert resp.status_code == 404, resp.text
        # The member is untouched in Store A and still bound to Store A only.
        rows = [m for m in owner_a.get("/api/store/members").json() if m["email"] == email]
        assert rows[0]["status"] == "active"
        assert rows[0]["role"] == "viewer"
        store_a = owner_a.get("/api/auth/me").json()["store"]["id"]
        assert member.get("/api/auth/me").json()["store"]["id"] == store_a
