"""Preferences and store-region updates: T-05 (regional setup) and T-06 (stale write)."""

from __future__ import annotations

from fastapi.testclient import TestClient


class TestPreferences:
    def test_unknown_preferences_start_null_and_set_persists(self, client: TestClient):
        me = client.get("/api/auth/me").json()
        assert me["preferences"]["locale"] is None
        assert me["preferences"]["displayCurrency"] is None

        current = me["preferences"]["version"]
        resp = client.post(
            "/api/preferences",
            json={
                "locale": "id",
                "displayCurrency": "IDR",
                "timezone": "Asia/Jakarta",
                "expectedVersion": current,
            },
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["version"] == current + 1
        assert body["preferences"]["displayCurrency"] == "IDR"
        # Partial update: untouched fields stay null, never coerced.
        assert body["preferences"]["numberFormat"] is None

        me2 = client.get("/api/auth/me").json()
        assert me2["preferences"]["displayCurrency"] == "IDR"
        assert me2["preferences"]["locale"] == "id"

    def test_stale_write_is_409_then_retry_with_current_version_succeeds(self, client: TestClient):
        current = client.get("/api/auth/me").json()["preferences"]["version"]

        first = client.post("/api/preferences", json={"locale": "id", "expectedVersion": current})
        assert first.status_code == 200, first.text

        # Stale: the version this client still holds has moved on → 409 + currentVersion.
        stale = client.post("/api/preferences", json={"locale": "en", "expectedVersion": current})
        assert stale.status_code == 409
        detail = stale.json()["detail"]
        assert detail["code"] == "version_conflict"
        assert detail["currentVersion"] == first.json()["version"]

        # Retry with the retained intent + the advertised current version → wins.
        retry = client.post(
            "/api/preferences",
            json={"locale": "en", "expectedVersion": detail["currentVersion"]},
        )
        assert retry.status_code == 200, retry.text
        assert retry.json()["preferences"]["locale"] == "en"

    def test_unauthenticated_preferences_is_401(self, unauth_client: TestClient):
        assert unauth_client.post("/api/preferences", json={"locale": "id"}).status_code == 401


class TestStoreRegion:
    """T-05: country/language/currency/timezone persist; country change alone
    never changes currency; changing store currency never relabels orders."""

    def test_country_change_does_not_alter_currency(self, client: TestClient):
        store = client.get("/api/store").json()["store"]
        version = store["version"]
        original_currency = store["defaultCurrency"]

        resp = client.post("/api/store", json={"country": "SG", "expectedVersion": version})
        assert resp.status_code == 200, resp.text
        updated = resp.json()["store"]
        assert updated["countryCode"] == "SG"
        # The whole point: country change alone does NOT touch the currency.
        assert updated["defaultCurrency"] == original_currency

    def test_store_currency_change_does_not_relabel_orders(self, client: TestClient):
        orders = client.get("/api/orders").json()
        assert orders, "seeded store must have at least one order for this invariant"
        order_before = orders[0]

        store = client.get("/api/store").json()["store"]
        resp = client.post(
            "/api/store",
            json={"defaultCurrency": "EUR", "expectedVersion": store["version"]},
        )
        assert resp.status_code == 200, resp.text

        # Orders keep the currency they were created with (historical documents).
        after = {o["id"]: o for o in client.get("/api/orders").json()}
        kept = after[order_before["id"]]
        assert kept["currency"] == order_before["currency"]
        assert kept["currency"] != "EUR" or order_before["currency"] == "EUR"

    def test_full_region_setup_persists(self, client: TestClient):
        store = client.get("/api/store").json()["store"]
        resp = client.post(
            "/api/store",
            json={
                "country": "ID",
                "locale": "id",
                "defaultCurrency": "IDR",
                "timezone": "Asia/Jakarta",
                "expectedVersion": store["version"],
            },
        )
        assert resp.status_code == 200, resp.text
        updated = resp.json()["store"]
        assert (
            updated["countryCode"] == "ID"
            and updated["locale"] == "id"
            and updated["defaultCurrency"] == "IDR"
            and updated["timezone"] == "Asia/Jakarta"
        )

        # Survives a fresh read (and a fresh session — see test_session logout+login).
        reread = client.get("/api/store").json()["store"]
        assert reread["countryCode"] == "ID" and reread["timezone"] == "Asia/Jakarta"

    def test_invalid_region_values_are_400(self, client: TestClient):
        store = client.get("/api/store").json()["store"]
        resp = client.post(
            "/api/store", json={"country": "ZZ", "expectedVersion": store["version"]}
        )
        assert resp.status_code == 400
        assert resp.json()["detail"]["field"] == "country"

    def test_stale_store_write_is_409(self, client: TestClient):
        store = client.get("/api/store").json()["store"]
        version = store["version"]
        assert (
            client.post(
                "/api/store", json={"name": "Renamed", "expectedVersion": version}
            ).status_code
            == 200
        )

        stale = client.post(
            "/api/store", json={"name": "Renamed twice", "expectedVersion": version}
        )
        assert stale.status_code == 409
        assert stale.json()["detail"]["code"] == "version_conflict"
        assert stale.json()["detail"]["currentVersion"] == version + 1
