"""API tests: health, suppliers, products, inventory risk (T-10, T-11, T-12)."""

from __future__ import annotations

from fastapi.testclient import TestClient

RISK_STATES = {
    "outOfStock",
    "atRisk",
    "runningLow",
    "healthy",
    "noRecentSales",
    "dataNeeded",
    "stale",
}


def _products(client: TestClient) -> list[dict]:
    response = client.get("/api/products")
    assert response.status_code == 200
    return response.json()


def _product_by_sku(products: list[dict], sku: str) -> dict:
    return next(product for product in products if product["sku"] == sku)


def test_health_reports_db_reachable(client: TestClient) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["db"]["reachable"] is True
    assert body["db"]["latencyMs"] >= 0


def test_suppliers_fixture(client: TestClient) -> None:
    response = client.get("/api/suppliers")
    assert response.status_code == 200
    suppliers = response.json()
    assert [supplier["code"] for supplier in suppliers] == ["SUP-001", "SUP-002"]
    freshfield = suppliers[0]
    assert freshfield["name"] == "Freshfield Foods"
    assert freshfield["documentCurrency"] == "USD"
    assert freshfield["leadTimeDays"] == 5
    assert freshfield["calendarConfirmed"] is True
    assert freshfield["deliveryDays"] == [0, 1, 2, 3, 4]
    daily_goods = suppliers[1]
    assert daily_goods["leadTimeDays"] == 3
    assert daily_goods["calendarConfirmed"] is False
    assert daily_goods["deliveryDays"] is None

    detail = client.get(f"/api/suppliers/{freshfield['id']}")
    assert detail.status_code == 200
    assert detail.json()["name"] == "Freshfield Foods"
    assert client.get("/api/suppliers/nope").status_code == 404


def test_products_include_risk_view_fields(client: TestClient) -> None:
    products = _products(client)
    assert len(products) == 4
    oat = _product_by_sku(products, "SKU-001")
    assert oat["name"] == "Oat milk 1 L"
    assert oat["supplier"]["code"] == "SUP-001"
    assert oat["terms"]["unitCost"] == "2.50"
    assert oat["terms"]["purchasePackUnits"] == 12
    assert oat["terms"]["minimumOrderUnits"] == "24"
    assert oat["terms"]["currency"] == "USD"
    for product in products:
        risk = product["risk"]
        assert set(risk) >= {
            "productId",
            "stock",
            "sales",
            "averageDailyDemand",
            "coverDays",
            "leadTime",
            "estimatedDepletion",
            "deliveryEstimate",
            "deliveryGap",
            "riskState",
            "blockers",
            "warnings",
            "sourceVersions",
        }
        assert risk["riskState"] in RISK_STATES
        assert isinstance(risk["stock"], dict) and "kind" in risk["stock"]
        assert isinstance(risk["sales"], dict) and "kind" in risk["sales"]
        assert isinstance(risk["coverDays"], dict) and "kind" in risk["coverDays"]


def test_product_detail_sku_chart(client: TestClient) -> None:
    oat = _product_by_sku(_products(client), "SKU-001")
    detail = client.get(f"/api/products/{oat['id']}").json()
    series = detail["salesSeries"]
    # T-11: 13 daily values, Sep 30 - Oct 12, 2026, total 52.
    assert len(series) == 13
    assert series[0] == {"date": "2026-09-30", "quantity": "3"}
    assert series[-1] == {"date": "2026-10-12", "quantity": "4"}
    assert [point["quantity"] for point in series] == [
        "3",
        "4",
        "2",
        "5",
        "4",
        "6",
        "4",
        "3",
        "5",
        "4",
        "3",
        "5",
        "4",
    ]
    assert sum(int(point["quantity"]) for point in series) == 52
    assert client.get("/api/products/nope").status_code == 404


def test_inventory_risk_oat_numbers(client: TestClient) -> None:
    response = client.get("/api/inventory/risk")
    assert response.status_code == 200
    views = response.json()
    assert len(views) == 4
    oat = next(view for view in views if view["sku"] == "SKU-001")
    # 12 on hand, 4/day over 13 covered days, 3 days cover, 5-day lead, ~2-day gap.
    assert oat["stock"] == {"kind": "known", "value": "12", "unit": "each", "asOf": "2026-10-13"}
    assert oat["sales"]["kind"] == "measured"
    assert oat["sales"]["total"] == "52"
    assert oat["sales"]["coveredDays"] == 13
    assert oat["sales"]["windowStart"] == "2026-09-30"
    assert oat["sales"]["windowEnd"] == "2026-10-12"
    assert oat["averageDailyDemand"] == {"kind": "known", "value": "4"}
    assert oat["coverDays"] == {"kind": "finite", "value": "3"}
    assert oat["leadTime"]["kind"] == "known"
    assert oat["leadTime"]["value"] == 5
    assert oat["leadTime"]["unit"] == "calendarDays"
    assert oat["leadTime"]["calendarConfirmed"] is True
    assert oat["estimatedDepletion"] == {"kind": "known", "date": "2026-10-16"}
    # T-12: Oct 13 + 5 days = Sunday Oct 18; weekday-only supplier -> unconfirmed.
    assert oat["deliveryEstimate"]["kind"] == "known"
    assert oat["deliveryEstimate"]["date"] == "2026-10-18"
    assert oat["deliveryEstimate"]["confirmed"] is False
    assert "Sunday" in oat["deliveryEstimate"]["reason"]
    assert oat["deliveryGap"] == {"kind": "finite", "value": "2", "unit": "days"}
    assert oat["riskState"] == "atRisk"
    assert oat["blockers"] == []
    assert any(warning["code"] == "delivery_estimate_unconfirmed" for warning in oat["warnings"])


def test_inventory_risk_other_states(client: TestClient) -> None:
    views = client.get("/api/inventory/risk").json()
    states = {view["sku"]: view["riskState"] for view in views}
    assert states == {
        "SKU-001": "atRisk",  # cover 3 < lead 5
        "SKU-002": "runningLow",  # cover 6 >= lead 3 but < target 7 + lead 3
        "SKU-003": "atRisk",  # cover 4 < lead 5
        "SKU-004": "runningLow",  # cover 4 >= lead 2 but < target 7 + lead 2
    }
    rice = next(view for view in views if view["sku"] == "SKU-002")
    assert rice["coverDays"] == {"kind": "finite", "value": "6"}
    assert rice["deliveryGap"] == {"kind": "finite", "value": "0", "unit": "days"}
    noodles = next(view for view in views if view["sku"] == "SKU-003")
    assert noodles["coverDays"] == {"kind": "finite", "value": "4"}
    assert noodles["deliveryGap"] == {"kind": "finite", "value": "1", "unit": "days"}
    water = next(view for view in views if view["sku"] == "SKU-004")
    assert water["deliveryEstimate"]["date"] == "2026-10-15"  # lead 2, Thursday
    assert water["deliveryEstimate"]["confirmed"] is False
    assert "no delivery calendar" in water["deliveryEstimate"]["reason"]
