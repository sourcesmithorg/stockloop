"""API tests: plan fixture totals, edits, approval invalidation (T-14, T-19, T-13)."""

from __future__ import annotations

from decimal import Decimal

from fastapi.testclient import TestClient


def _plan(client: TestClient, plan_id: str) -> dict:
    response = client.get(f"/api/plans/{plan_id}")
    assert response.status_code == 200
    return response.json()


def _line(plan: dict, sku: str) -> dict:
    return next(line for line in plan["lines"] if line["sku"] == sku)


def _fresh_plan(client: TestClient, fresh_plan_id: str) -> dict:
    return _plan(client, fresh_plan_id)


def test_seeded_plan_fixture_totals(client: TestClient) -> None:
    plans = client.get("/api/plans").json()
    assert len(plans) >= 1
    plan = _plan(client, plans[0]["id"])

    assert plan["version"] == 1
    assert plan["calculationStatus"] == "valid"
    assert plan["reviewStatus"] == "approved"
    assert plan["totalsByCurrency"] == {"USD": "384.00"}

    quantities = {
        line["sku"]: (
            line["effectiveBaseUnits"],
            line["purchasePackCount"],
            line["purchasePackUnits"],
            line["unitCost"],
            line["lineTotal"],
        )
        for line in plan["lines"]
    }
    assert quantities == {
        "SKU-001": ("48", 4, 12, "2.50", "120.00"),
        "SKU-002": ("30", 5, 6, "4.00", "120.00"),
        "SKU-003": ("96", 4, 24, "0.75", "72.00"),
        "SKU-004": ("48", 4, 12, "1.50", "72.00"),
    }
    total_units = sum(
        Decimal(line["originalSuggestedBaseUnits"]) for line in plan["lines"] if line["selected"]
    )
    assert total_units == Decimal(222)

    budget = plan["budgets"][0]
    assert budget["currency"] == "USD"
    assert budget["budgetAmount"] == "500.00"
    assert budget["selectedTotal"] == "384.00"
    assert budget["remaining"] == "116.00"
    assert budget["utilizationPercent"] == "76.8"
    assert budget["taxTreatment"] == "excluded"
    assert budget["shippingTreatment"] == "excluded"

    groups = plan["supplierGroups"]
    assert [(g["supplierCode"], g["subtotal"], g["lineCount"]) for g in groups] == [
        ("SUP-001", "240.00", 2),
        ("SUP-002", "144.00", 2),
    ]
    assert plan["blockers"] == []
    assert any(warning["code"] == "tax_shipping_excluded" for warning in plan["warnings"])


def test_seeded_plan_rule_trace_and_approval(client: TestClient) -> None:
    plan = _plan(client, client.get("/api/plans").json()[0]["id"])
    oat = _line(plan, "SKU-001")
    trace = oat["ruleTrace"]
    assert trace["demandPerDay"] == "4"
    assert trace["coverDays"] == "3"
    assert trace["horizonDays"] == 14
    assert trace["grossTargetUnits"] == "56"
    assert trace["onHandUnits"] == "12"
    assert trace["rawRequiredUnits"] == "44"
    assert trace["minimumOrderUnits"] == "24"
    assert trace["roundedUnits"] == "48"
    assert trace["purchasePackCount"] == 4
    assert trace["moqApplied"] is False
    assert oat["termsVersion"] == 1

    approval = plan["activeApproval"]
    assert approval is not None
    assert approval["planVersion"] == 1
    assert approval["status"] == "active"
    assert approval["contentDigest"]
    orders = approval["orders"]
    assert [order["displayNumber"] for order in orders] == ["PO-2026-0142", "PO-2026-0143"]
    assert [order["itemSubtotal"] for order in orders] == ["240.00", "144.00"]
    assert all(order["taxTreatment"] == "excluded" for order in orders)
    assert all(order["documentStatus"] == "approved" for order in orders)


def test_orders_endpoints(client: TestClient) -> None:
    orders = client.get("/api/orders").json()
    numbers = {order["displayNumber"]: order for order in orders}
    assert "PO-2026-0142" in numbers
    assert "PO-2026-0143" in numbers
    freshfield = numbers["PO-2026-0142"]
    daily_goods = numbers["PO-2026-0143"]
    # T-01 regression: rows are distinct records with their own identity/amounts.
    assert freshfield["supplierName"] == "Freshfield Foods"
    assert freshfield["itemSubtotal"] == "240.00"
    assert daily_goods["supplierName"] == "Daily Goods Co."
    assert daily_goods["itemSubtotal"] == "144.00"
    assert freshfield["id"] != daily_goods["id"]

    detail = client.get(f"/api/orders/{freshfield['id']}").json()
    assert detail["displayNumber"] == "PO-2026-0142"
    assert detail["planVersion"] == 1
    assert detail["approvalStatus"] == "active"
    assert {line["sku"] for line in detail["lines"]} == {"SKU-001", "SKU-002"}
    assert detail["disclaimer"]
    assert client.get("/api/orders/nope").status_code == 404


def test_edit_rejects_off_pack_negative_and_stale(client: TestClient, fresh_plan_id: str) -> None:
    plan = _fresh_plan(client, fresh_plan_id)
    oat = _line(plan, "SKU-001")

    off_pack = client.post(
        f"/api/plans/{fresh_plan_id}/lines/{oat['id']}",
        json={"editedBaseUnits": "50", "expectedPlanVersion": plan["version"]},
    )
    assert off_pack.status_code == 422
    assert off_pack.json()["detail"]["code"] == "off_pack_quantity"

    negative = client.post(
        f"/api/plans/{fresh_plan_id}/lines/{oat['id']}",
        json={"editedBaseUnits": "-12", "expectedPlanVersion": plan["version"]},
    )
    assert negative.status_code == 422
    assert negative.json()["detail"]["code"] == "invalid_quantity"

    stale = client.post(
        f"/api/plans/{fresh_plan_id}/lines/{oat['id']}",
        json={"editedBaseUnits": "48", "expectedPlanVersion": 999},
    )
    assert stale.status_code == 409
    assert stale.json()["detail"]["code"] == "stale_plan_version"
    assert stale.json()["detail"]["currentVersion"] == plan["version"]


def test_edit_recalculates_and_invalidates_approval(client: TestClient, fresh_plan_id: str) -> None:
    plan = _fresh_plan(client, fresh_plan_id)
    assert plan["reviewStatus"] == "draft"

    approved = client.post(
        f"/api/plans/{fresh_plan_id}/approve",
        json={"expectedPlanVersion": plan["version"], "acknowledgedWarnings": []},
    )
    assert approved.status_code == 200
    approval = approved.json()
    assert approval["planVersion"] == 1
    assert len(approval["orders"]) == 2

    oat = _line(plan, "SKU-001")
    edited = client.post(
        f"/api/plans/{fresh_plan_id}/lines/{oat['id']}",
        json={"editedBaseUnits": "60", "expectedPlanVersion": 1},
    )
    assert edited.status_code == 200
    updated = edited.json()
    assert updated["version"] == 2
    assert updated["reviewStatus"] == "stale"
    assert updated["activeApproval"] is None

    line = _line(updated, "SKU-001")
    assert line["editedBaseUnits"] == "60"
    assert line["effectiveBaseUnits"] == "60"
    assert line["purchasePackCount"] == 5
    assert line["lineTotal"] == "150.00"  # 60 x 2.50, recomputed by trusted code
    # Totals recomputed: 384 - 120 + 150 = 414.00; approval cannot export changed content.
    assert updated["totalsByCurrency"] == {"USD": "414.00"}
    assert "edited by the owner" in line["explanation"]

    orders = client.get("/api/orders").json()
    stale_orders = [order for order in orders if order["planId"] == fresh_plan_id]
    assert stale_orders and all(order["documentStatus"] == "superseded" for order in stale_orders)
    assert all(order["approvalStatus"] == "stale" for order in stale_orders)

    # Stale version cannot be re-approved; only the current version can.
    reapprove_stale = client.post(
        f"/api/plans/{fresh_plan_id}/approve", json={"expectedPlanVersion": 1}
    )
    assert reapprove_stale.status_code == 409

    reapprove = client.post(f"/api/plans/{fresh_plan_id}/approve", json={"expectedPlanVersion": 2})
    assert reapprove.status_code == 200
    assert reapprove.json()["planVersion"] == 2
    assert _plan(client, fresh_plan_id)["reviewStatus"] == "approved"


def test_approve_is_idempotent_for_same_version(client: TestClient, fresh_plan_id: str) -> None:
    plan = _fresh_plan(client, fresh_plan_id)
    first = client.post(
        f"/api/plans/{fresh_plan_id}/approve",
        json={"expectedPlanVersion": plan["version"]},
    )
    assert first.status_code == 200
    second = client.post(
        f"/api/plans/{fresh_plan_id}/approve",
        json={"expectedPlanVersion": plan["version"]},
    )
    assert second.status_code == 200
    assert second.json()["id"] == first.json()["id"]
    assert len(second.json()["orders"]) == len(first.json()["orders"]) == 2


def test_below_moq_blocks_approval_until_resolved(client: TestClient, fresh_plan_id: str) -> None:
    plan = _fresh_plan(client, fresh_plan_id)
    oat = _line(plan, "SKU-001")

    # 12 is a pack multiple but below the 24-unit MOQ: the edit is allowed,
    # the constraint fails, and approval is blocked (T-13).
    edited = client.post(
        f"/api/plans/{fresh_plan_id}/lines/{oat['id']}",
        json={"editedBaseUnits": "12", "expectedPlanVersion": plan["version"]},
    )
    assert edited.status_code == 200
    blocked = edited.json()
    assert blocked["calculationStatus"] == "blocked"
    assert any(issue["code"] == "line_minimum_order_units" for issue in blocked["blockers"])

    approval = client.post(
        f"/api/plans/{fresh_plan_id}/approve", json={"expectedPlanVersion": blocked["version"]}
    )
    assert approval.status_code == 422
    detail = approval.json()["detail"]
    assert detail["code"] == "blocking_constraints"
    assert any(issue["code"] == "line_minimum_order_units" for issue in detail["blockers"])

    resolved = client.post(
        f"/api/plans/{fresh_plan_id}/lines/{oat['id']}",
        json={"editedBaseUnits": "48", "expectedPlanVersion": blocked["version"]},
    )
    assert resolved.status_code == 200
    assert resolved.json()["calculationStatus"] == "valid"
    approval_again = client.post(
        f"/api/plans/{fresh_plan_id}/approve",
        json={"expectedPlanVersion": resolved.json()["version"]},
    )
    assert approval_again.status_code == 200


def test_zero_edit_excludes_line_from_totals(client: TestClient, fresh_plan_id: str) -> None:
    plan = _fresh_plan(client, fresh_plan_id)
    noodles = _line(plan, "SKU-003")
    edited = client.post(
        f"/api/plans/{fresh_plan_id}/lines/{noodles['id']}",
        json={"editedBaseUnits": "0", "expectedPlanVersion": plan["version"]},
    )
    assert edited.status_code == 200
    updated = edited.json()
    line = _line(updated, "SKU-003")
    assert line["selected"] is False
    # 384.00 - 72.00 excluded: explicit exclusion, not a silent cut.
    assert updated["totalsByCurrency"] == {"USD": "312.00"}
    groups = {group["supplierCode"]: group["subtotal"] for group in updated["supplierGroups"]}
    assert groups == {"SUP-001": "240.00", "SUP-002": "72.00"}
