"""Session cookie behaviour: cross-store isolation, tampering, persistence (M2)."""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def second_store_client() -> TestClient:
    """Register an independent store+owner in a fresh app/client; returns it logged in."""
    from fastapi.testclient import TestClient as TC

    from app.main import create_app

    with TC(create_app()) as fresh:
        resp = fresh.post(
            "/api/auth/register",
            json={
                "email": f"second-{uuid.uuid4().hex[:10]}@stockloop.test",
                "password": "CorrectHorse123!",
                "storeName": "Second Store",
                "country": "SG",
                "language": "en",
                "currency": "SGD",
                "timezone": "Asia/Singapore",
            },
        )
        assert resp.status_code == 201, resp.text
        yield fresh


class TestCrossStoreIsolation:
    def test_store_b_cannot_read_store_a_records(
        self, client: TestClient, second_store_client: TestClient
    ):
        # Store A (seeded) has orders and a plan.
        order = client.get("/api/orders").json()[0]
        plan_id = client.get("/api/plans").json()[0]["id"]

        b = second_store_client
        # B's own reads work but are empty — never see A's rows.
        assert b.get("/api/orders").json() == []
        assert b.get("/api/plans").json() == []
        assert b.get(f"/api/plans/{plan_id}").status_code == 404
        # Direct access to A's records → 404, not 403 (no existence leak).
        assert b.get(f"/api/orders/{order['id']}").status_code == 404
        assert b.get(f"/api/plans/{plan_id}").status_code == 404

    def test_store_b_get_store_returns_its_own_store(
        self, client: TestClient, second_store_client: TestClient
    ):
        a_store = client.get("/api/store").json()["store"]
        b = second_store_client
        b_store = b.get("/api/store").json()["store"]
        assert b_store["id"] != a_store["id"]
        assert b_store["defaultCurrency"] == "SGD"

    def test_tampered_cookie_is_rejected(self, client: TestClient):
        from app.seed import FIXTURE_OWNER_EMAIL, FIXTURE_OWNER_PASSWORD

        # The owner client is authenticated; corrupt the cookie and expect 401.
        cookie = client.cookies.get("session")
        assert cookie
        tampered = cookie[:-1] + ("x" if cookie[-1] != "x" else "y")
        client.cookies.set("session", tampered, path="/")
        try:
            assert client.get("/api/auth/me").status_code == 401
        finally:
            # httpx.Cookies.set can't replicate HttpOnly/SameSite, so a manual restore
            # would leave a stray duplicate that survives logout. Wipe + re-login instead.
            client.cookies.clear()
            client.post(
                "/api/auth/login",
                json={"email": FIXTURE_OWNER_EMAIL, "password": FIXTURE_OWNER_PASSWORD},
            )

    def test_unknown_signature_key_is_rejected(self, unauth_client: TestClient):
        # A structurally valid but unsigned/forged cookie must not authenticate.
        forged = (
            "eyJ1c2VyX2lkIjoiZmFrZSIsInN0b3JlX2lkIjoiZmFrZSIsInJvbGUiOiJvd25lciIsImV4cCI6OTk5OTk5OTk5OX0"
            ".deadbeef"
        )
        unauth_client.cookies.set("session", forged)
        assert unauth_client.get("/api/auth/me").status_code == 401


class TestPersistenceAcrossSessions:
    def test_region_and_preferences_survive_logout_and_login(self, client: TestClient):
        from app.seed import FIXTURE_OWNER_EMAIL, FIXTURE_OWNER_PASSWORD

        store = client.get("/api/store").json()["store"]
        resp = client.post(
            "/api/store",
            json={"country": "ID", "timezone": "Asia/Jakarta", "expectedVersion": store["version"]},
        )
        assert resp.status_code == 200, resp.text
        pref_version = client.get("/api/auth/me").json()["preferences"]["version"]
        client.post("/api/preferences", json={"locale": "id", "expectedVersion": pref_version})

        client.post("/api/auth/logout")
        assert client.get("/api/auth/me").status_code == 401

        client.post(
            "/api/auth/login",
            json={"email": FIXTURE_OWNER_EMAIL, "password": FIXTURE_OWNER_PASSWORD},
        )
        me = client.get("/api/auth/me").json()
        assert me["store"]["countryCode"] == "ID"
        assert me["store"]["timezone"] == "Asia/Jakarta"
        assert me["preferences"]["locale"] == "id"
