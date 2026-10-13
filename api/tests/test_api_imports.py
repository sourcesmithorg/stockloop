"""API tests: CSV import preview/commit (T-07, T-08, T-09)."""

from __future__ import annotations

import io

from fastapi.testclient import TestClient


def _upload(client: TestClient, content: str, filename: str = "sales.csv") -> tuple[int, dict]:
    response = client.post(
        "/api/imports/preview",
        files={"file": (filename, io.BytesIO(content.encode("utf-8")), "text/csv")},
    )
    return response.status_code, response.json()


def test_preview_valid_sales_csv(client: TestClient) -> None:
    content = "sku,sale_date,quantity_sold\nSKU-001,2026-10-20,4\nSKU-004,2026-10-21,6\n"
    status, body = _upload(client, content)
    assert status == 200
    assert body["dataset"] == "sales"
    assert body["status"] == "validated"
    assert body["commitPolicy"] == "atomic"
    assert body["counts"] == {
        "totalRows": 2,
        "validRows": 2,
        "warningRows": 0,
        "rejectedRows": 0,
    }
    assert body["issues"] == []
    assert len(body["sourceDigest"]) == 64

    committed = client.post(f"/api/imports/{body['importId']}/commit")
    assert committed.status_code == 200
    result = committed.json()
    assert result["status"] == "committed"
    assert result["appliedRows"] == 2
    assert result["resultingStoreVersion"] >= 2

    # Idempotent replay: same import committed twice changes nothing (T-09).
    replay = client.post(f"/api/imports/{body['importId']}/commit")
    assert replay.status_code == 200
    assert replay.json() == result


def test_preview_counts_issue_severity_and_rows(client: TestClient) -> None:
    content = (
        "sku,sale_date,quantity_sold\n"
        "SKU-001,2026-10-20,4\n"  # valid
        "SKU-001,2026-10-21,abc\n"  # blocking: invalid quantity
        "SKU-999,2026-10-22,5\n"  # blocking: unknown sku
        "SKU-001,2026-10-20,7\n"  # warning: duplicate key in file
    )
    status, body = _upload(client, content)
    assert status == 200
    assert body["status"] == "blocked"
    assert body["counts"] == {
        "totalRows": 4,
        "validRows": 1,
        "warningRows": 1,
        "rejectedRows": 2,
    }
    codes = {
        (issue["rowNumber"], issue["issueCode"], issue["severity"]) for issue in body["issues"]
    }
    assert (2, "invalid_quantity", "blocking") in codes
    assert (3, "unknown_sku", "blocking") in codes
    assert (4, "duplicate_key", "warning") in codes
    # Issue count (3) is not the rejected-row count (2) (T-08).
    assert len(body["issues"]) == 3
    assert body["counts"]["rejectedRows"] == 2

    # No success while blockers remain (T-08): commit is refused.
    refused = client.post(f"/api/imports/{body['importId']}/commit")
    assert refused.status_code == 409
    detail = refused.json()["detail"]
    assert detail["code"] == "import_blocked"
    assert detail["counts"]["rejectedRows"] == 2
    assert any(issue["issueCode"] == "unknown_sku" for issue in detail["issues"])


def test_preview_missing_mapped_column_blocks(client: TestClient) -> None:
    content = "date,qty\n2026-10-20,4\n"
    status, body = _upload(client, content)
    assert status == 200
    assert body["dataset"] == "unknown"
    assert body["status"] == "blocked"
    assert any(issue["issueCode"] == "unknown_dataset" for issue in body["issues"])

    # T-07: forcing the sales mapping without a sku column gives a field-associated error.
    response = client.post(
        "/api/imports/preview",
        files={"file": ("sales.csv", io.BytesIO(content.encode("utf-8")), "text/csv")},
        data={"dataset": "sales"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "blocked"
    missing = [issue for issue in body["issues"] if issue["issueCode"] == "missing_required_column"]
    assert {issue["field"] for issue in missing} >= {"sku", "sale_date", "quantity_sold"}


def test_commit_skips_existing_rows_without_duplicating(client: TestClient) -> None:
    # 2026-10-05 already exists for SKU-001 (fixture data): warning, skipped at commit.
    content = "sku,sale_date,quantity_sold\nSKU-001,2026-10-05,4\nSKU-001,2026-10-20,9\n"
    status, body = _upload(client, content)
    assert status == 200
    assert body["status"] == "validated"
    assert body["counts"]["warningRows"] == 1
    assert any(issue["issueCode"] == "duplicate_existing" for issue in body["issues"])

    committed = client.post(f"/api/imports/{body['importId']}/commit")
    assert committed.status_code == 200
    result = committed.json()
    assert result["appliedRows"] == 1
    assert result["skippedRows"] == 1

    # Replaying the same file bytes under a new job cannot duplicate data (T-09).
    status2, body2 = _upload(client, content, filename="sales-again.csv")
    assert status2 == 200
    replay = client.post(f"/api/imports/{body2['importId']}/commit")
    assert replay.status_code == 409
    detail = replay.json()["detail"]
    assert detail["code"] == "import_already_committed"
    assert detail["existingImportId"] == body["importId"]


def test_preview_inventory_csv(client: TestClient) -> None:
    content = (
        "sku,product_name,stock_on_hand,snapshot_date,supplier_id\n"
        "SKU-001,Oat milk 1 L,99,2026-10-20,SUP-001\n"
        "SKU-001,Oat milk 1 L,50,2026-10-21,SUP-001\n"
        "SKU-001,Oat milk 1 L,10,2026-10-22,SUP-999\n"
    )
    status, body = _upload(client, content, filename="inventory.csv")
    assert status == 200
    assert body["dataset"] == "inventory"
    codes = [issue["issueCode"] for issue in body["issues"]]
    assert "duplicate_key" in codes
    assert "unknown_supplier" in codes
    assert body["counts"]["rejectedRows"] == 1
