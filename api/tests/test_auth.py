"""Auth endpoints: register, login, logout, me; password never plaintext (M2)."""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient


def _register(client: TestClient, **over):
    body = {
        "email": f"owner-{uuid.uuid4().hex[:10]}@stockloop.test",
        "password": "CorrectHorse123!",
        "storeName": "Kopi Nusantara",
        "country": "ID",
        "language": "id",
        "currency": "IDR",
        "timezone": "Asia/Jakarta",
    }
    body.update(over)
    return client.post("/api/auth/register", json=body), body


class TestRegister:
    def test_register_returns_201_and_sets_cookie(self, unauth_client: TestClient):
        resp, body = _register(unauth_client)
        assert resp.status_code == 201, resp.text
        data = resp.json()
        assert data["user"]["email"] == body["email"]
        assert data["user"]["role"] == "owner"
        assert data["store"]["countryCode"] == "ID"
        assert data["store"]["defaultCurrency"] == "IDR"
        # Blank preferences: every override starts null ("follow store").
        assert data["preferences"]["locale"] is None
        assert data["preferences"]["displayCurrency"] is None
        # Session cookie is set, httpOnly + SameSite=Lax.
        assert "session=" in resp.headers.get("set-cookie", "")

    def test_register_duplicate_email_is_409(self, unauth_client: TestClient):
        resp, body = _register(unauth_client)
        assert resp.status_code == 201, resp.text
        dup, _ = _register(unauth_client, email=body["email"])
        assert dup.status_code == 409
        assert dup.json()["detail"]["code"] == "email_exists"

    def test_register_invalid_region_is_400_field_scoped(self, unauth_client: TestClient):
        resp, _ = _register(unauth_client, country="ZZ")
        assert resp.status_code == 400
        assert resp.json()["detail"]["field"] == "country"

        resp, _ = _register(unauth_client, currency="XYZ")
        assert resp.status_code == 400
        assert resp.json()["detail"]["field"] == "currency"

        resp, _ = _register(unauth_client, timezone="Not/AZone")
        assert resp.status_code == 400
        assert resp.json()["detail"]["field"] == "timezone"

    def test_register_short_password_is_422(self, unauth_client: TestClient):
        resp, _ = _register(unauth_client, password="short")
        assert resp.status_code == 422

    def test_register_documented_defaults_are_valid(self, unauth_client: TestClient):
        # The template's default registration values (US/en/USD/UTC) must pass
        # backend validation — a dropped region_data entry would 400 here.
        resp, _ = _register(
            unauth_client, country="US", language="en", currency="USD", timezone="UTC"
        )
        assert resp.status_code == 201, resp.text
        assert resp.json()["store"]["countryCode"] == "US"
        assert resp.json()["store"]["defaultCurrency"] == "USD"


class TestLogin:
    def test_login_wrong_password_and_unknown_email_are_identical(self, unauth_client: TestClient):
        _, body = _register(unauth_client)
        # Wrong password vs unknown email → identical 401 message (no enumeration).
        wrong = unauth_client.post(
            "/api/auth/login",
            json={"email": body["email"], "password": "Nope12345678!"},
        )
        unknown = unauth_client.post(
            "/api/auth/login",
            json={"email": "ghost@stockloop.test", "password": "Nope12345678!"},
        )
        assert wrong.status_code == 401 and unknown.status_code == 401
        assert wrong.json() == unknown.json()

    def test_login_correct_password_returns_store_and_sets_cookie(self, unauth_client: TestClient):
        _, body = _register(unauth_client)
        resp = unauth_client.post(
            "/api/auth/login", json={"email": body["email"], "password": body["password"]}
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["store"]["name"] == body["storeName"]
        assert "session=" in resp.headers.get("set-cookie", "")


class TestSessionLifecycle:
    def test_me_401_200_then_401_after_logout(self, unauth_client: TestClient):
        # me with no cookie → 401.
        assert unauth_client.get("/api/auth/me").status_code == 401

        _, body = _register(unauth_client)
        unauth_client.post(
            "/api/auth/login", json={"email": body["email"], "password": body["password"]}
        )
        me = unauth_client.get("/api/auth/me")
        assert me.status_code == 200
        assert me.json()["firstRunComplete"] is False

        # logout → 204, then me is 401 again.
        assert unauth_client.post("/api/auth/logout").status_code == 204
        assert unauth_client.get("/api/auth/me").status_code == 401


class TestPasswordStorage:
    def test_password_is_never_plaintext_in_db(self, unauth_client: TestClient):
        import asyncio

        from sqlalchemy import select
        from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

        from app.models import User

        _, body = _register(unauth_client)

        async def fetch():
            engine = create_async_engine(unauth_client.app.state.settings.database_url)
            try:
                factory = async_sessionmaker(engine, expire_on_commit=False)
                async with factory() as session:
                    user = (
                        (await session.execute(select(User).where(User.email == body["email"])))
                        .scalars()
                        .one()
                    )
                    return user.password_hash
            finally:
                await engine.dispose()

        stored = asyncio.run(fetch())
        assert stored != body["password"]
        assert stored.startswith("scrypt$")
        assert body["password"] not in stored


class TestFirstRunCompletion:
    """P0 regression: firstRunComplete is an explicit onboarding flag, never
    inferred from data readiness — a fresh store must reach the app."""

    def test_register_starts_incomplete(self, unauth_client: TestClient):
        _, body = _register(unauth_client)
        me = unauth_client.get("/api/auth/me")
        assert me.status_code == 200
        assert me.json()["firstRunComplete"] is False
        # GET /api/store reflects the same flag.
        store = unauth_client.get("/api/store").json()["store"]
        assert store["firstRunComplete"] is False

    def test_region_saves_alone_do_not_complete_first_run(self, unauth_client: TestClient):
        _register(unauth_client)
        store = unauth_client.get("/api/auth/me").json()["store"]
        resp = unauth_client.post(
            "/api/store",
            json={
                "country": "SG",
                "timezone": "Asia/Singapore",
                "expectedVersion": store["version"],
            },
        )
        assert resp.status_code == 200, resp.text
        assert unauth_client.get("/api/auth/me").json()["firstRunComplete"] is False

    def test_explicit_completion_flips_flag_and_admits_empty_store(self, unauth_client: TestClient):
        _register(unauth_client)
        store = unauth_client.get("/api/auth/me").json()["store"]
        resp = unauth_client.post(
            "/api/store",
            json={"completeFirstRun": True, "expectedVersion": store["version"]},
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["store"]["firstRunComplete"] is True
        assert unauth_client.get("/api/auth/me").json()["firstRunComplete"] is True

        # The lockout case: no products, no imports — yet operational routes
        # answer 200, so the guard (fed by /me) admits the store to the app.
        orders = unauth_client.get("/api/orders")
        assert orders.status_code == 200
        assert orders.json() == []
        assert unauth_client.get("/api/auth/me").json()["firstRunComplete"] is True

    def test_seeded_fixture_store_reports_first_run_true(self, client: TestClient):
        me = client.get("/api/auth/me")
        assert me.status_code == 200
        assert me.json()["firstRunComplete"] is True
