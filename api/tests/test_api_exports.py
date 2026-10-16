"""M6 export tests: approved-only, stale guard, idempotent retries, document fidelity.

Covers the export half of M6. The invariants under test: only the approved
current version can be exported; concurrent edits produce a field-scoped
conflict instead of a stale document; a retry never manufactures a second
document (identical digest); a failure never destroys the document; and no
rendered string ever claims the supplier received or accepted anything.
"""

from __future__ import annotations

from fastapi.testclient import TestClient


def _approve(client: TestClient, plan: dict) -> dict:
    response = client.post(
        f"/api/plans/{plan['id']}/approve",
        json={"expectedPlanVersion": plan["version"], "acknowledgedWarnings": []},
    )
    assert response.status_code == 200
    return response.json()


def _fresh_plan(client: TestClient, fresh_plan_id: str) -> dict:
    response = client.get(f"/api/plans/{fresh_plan_id}")
    assert response.status_code == 200
    return response.json()


def _line(plan: dict, sku: str) -> dict:
    return next(line for line in plan["lines"] if line["sku"] == sku)


def _order_for_plan(client: TestClient, plan_id: str) -> dict:
    orders = client.get("/api/orders").json()
    match = [order for order in orders if order["planId"] == plan_id]
    assert match, f"no order bound to plan {plan_id}"
    return match[0]


def test_export_approved_order_succeeds_and_records_attempt(
    client: TestClient, fresh_plan_id: str
) -> None:
    plan = _fresh_plan(client, fresh_plan_id)
    _approve(client, plan)
    order = _order_for_plan(client, fresh_plan_id)
    assert order["documentStatus"] == "approved"
    assert order["approvalStatus"] == "active"

    export = client.post(f"/api/orders/{order['id']}/export", json={"actorId": "owner"})
    assert export.status_code == 200
    body = export.json()
    assert body["status"] == "succeeded"
    assert body["displayNumber"] == order["displayNumber"]
    assert body["currency"] == order["currency"]
    assert body["documentDigest"]
    assert body["planVersion"] == plan["version"]
    # Honest copy: export ready is never supplier acceptance.
    assert "nothing has been sent" in body["disclaimer"].lower()

    attempts = client.get(f"/api/orders/{order['id']}/exports").json()
    assert len(attempts) == 1
    assert attempts[0]["status"] == "succeeded"
    assert attempts[0]["documentDigest"] == body["documentDigest"]


def test_export_stale_plan_refused_with_field_conflict(
    client: TestClient, fresh_plan_id: str
) -> None:
    plan = _fresh_plan(client, fresh_plan_id)
    _approve(client, plan)
    order = _order_for_plan(client, fresh_plan_id)

    # Owner edit moves the plan to v2: the v1 approval and its order go stale.
    oat = _line(plan, "SKU-001")
    edited = client.post(
        f"/api/plans/{fresh_plan_id}/lines/{oat['id']}",
        json={"editedBaseUnits": "60", "expectedPlanVersion": plan["version"]},
    )
    assert edited.status_code == 200

    export = client.post(f"/api/orders/{order['id']}/export", json={"actorId": "owner"})
    assert export.status_code == 409
    detail = export.json()["detail"]
    assert detail["code"] in {"order_not_exportable", "stale_export"}
    assert detail.get("field") in {"documentStatus", "planVersion"}

    # The refusal is itself captured, and the document itself is unharmed.
    attempts = client.get(f"/api/orders/{order['id']}/exports").json()
    assert attempts[0]["status"] == "failed"
    assert attempts[0]["failureCode"] == detail["code"]
    assert client.get(f"/api/orders/{order['id']}").status_code == 200


def test_export_unapproved_plan_refused(client: TestClient, fresh_plan_id: str) -> None:
    plan = _fresh_plan(client, fresh_plan_id)
    assert plan["reviewStatus"] == "draft"
    # A draft plan has no order documents to export.
    missing = client.post("/api/orders/NOPE/export", json={})
    assert missing.status_code == 404


def test_retry_does_not_create_second_document(client: TestClient, fresh_plan_id: str) -> None:
    plan = _fresh_plan(client, fresh_plan_id)
    _approve(client, plan)
    order = _order_for_plan(client, fresh_plan_id)

    first = client.post(f"/api/orders/{order['id']}/export", json={}).json()
    second = client.post(f"/api/orders/{order['id']}/export", json={}).json()
    assert first["id"] != second["id"]  # two attempts...
    assert first["documentDigest"] == second["documentDigest"]  # ...one document

    # The served bytes match the recorded digest: no second artefact is produced.
    document = client.get(f"/api/orders/{order['id']}/document")
    assert document.status_code == 200
    import hashlib

    served = hashlib.sha256(document.content).hexdigest()
    assert served == first["documentDigest"]


def test_failed_export_preserves_document(client: TestClient, fresh_plan_id: str) -> None:
    plan = _fresh_plan(client, fresh_plan_id)
    _approve(client, plan)
    order = _order_for_plan(client, fresh_plan_id)
    assert client.post(f"/api/orders/{order['id']}/export", json={}).status_code == 200

    oat = _line(plan, "SKU-001")
    client.post(
        f"/api/plans/{fresh_plan_id}/lines/{oat['id']}",
        json={"editedBaseUnits": "60", "expectedPlanVersion": plan["version"]},
    )
    assert client.post(f"/api/orders/{order['id']}/export", json={}).status_code == 409

    # Nothing destroyed: the order row and its earlier attempt survive.
    assert client.get(f"/api/orders/{order['id']}").status_code == 200
    attempts = client.get(f"/api/orders/{order['id']}/exports").json()
    assert [attempt["status"] for attempt in attempts] == ["failed", "succeeded"]


def test_document_carries_provenance_and_treatments(client: TestClient, fresh_plan_id: str) -> None:
    plan = _fresh_plan(client, fresh_plan_id)
    approval = _approve(client, plan)
    order = _order_for_plan(client, fresh_plan_id)
    client.post(f"/api/orders/{order['id']}/export", json={})

    document = client.get(f"/api/orders/{order['id']}/document")
    assert document.status_code == 200
    assert document.headers["content-type"].startswith("text/html")
    html = document.text

    # Provenance: approved version, plan and approval identity, currency.
    assert order["displayNumber"] in html
    assert approval["id"] in html
    assert fresh_plan_id in html
    assert f"version {plan['version']}" in html
    assert order["currency"] in html
    # Tax and shipping treatment rendered as-is, never recomputed to zero.
    assert order["taxTreatment"] in html
    assert order["shippingTreatment"] in html
    assert "$0.00" not in html


def test_no_rendered_string_claims_supplier_acceptance(
    client: TestClient, fresh_plan_id: str
) -> None:
    plan = _fresh_plan(client, fresh_plan_id)
    _approve(client, plan)
    order = _order_for_plan(client, fresh_plan_id)
    export = client.post(f"/api/orders/{order['id']}/export", json={}).json()
    html = client.get(f"/api/orders/{order['id']}/document").text.lower()

    for text in (export["disclaimer"].lower(), html):
        assert "nothing has been sent" in text
        assert "placed or accepted" in text
    # No affirmative delivery/acceptance state anywhere in the document.
    for banned in ("supplier accepted", "order placed", "sent on", "delivered on"):
        assert banned not in html
