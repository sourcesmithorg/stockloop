"""T-20 authorization: 401 unauthenticated, 403 viewer mutations across routers."""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

# Operational (non-health) routers must reject an unauthenticated caller with 401.
UNAUTH_GETS = [
    "/api/auth/me",
    "/api/store",
    "/api/suppliers",
    "/api/products",
    "/api/inventory/risk",
    "/api/plans",
    "/api/orders",
]


@pytest.mark.parametrize("path", UNAUTH_GETS)
def test_operational_routers_require_auth(unauth_client: TestClient, path: str):
    assert unauth_client.get(path).status_code == 401, path


def test_health_is_public(unauth_client: TestClient):
    assert unauth_client.get("/api/health").status_code == 200


def test_unauthenticated_mutation_is_401(unauth_client: TestClient):
    assert unauth_client.post("/api/preferences", json={"locale": "id"}).status_code == 401
    assert unauth_client.post("/api/store", json={"name": "x"}).status_code == 401


class TestViewerMutations:
    """A viewer may read and edit their own preferences, but mutate nothing else."""

    def test_viewer_can_update_own_preferences(self, viewer_client: TestClient):
        version = viewer_client.get("/api/auth/me").json()["preferences"]["version"]
        resp = viewer_client.post(
            "/api/preferences", json={"timezone": "Asia/Jakarta", "expectedVersion": version}
        )
        assert resp.status_code == 200, resp.text

    @pytest.mark.parametrize(
        "method,path,payload",
        [
            ("post", "/api/store", {"name": "Renamed by viewer"}),
            ("post", f"/api/plans/{uuid.uuid4()}/lines/{uuid.uuid4()}", {"editedBaseUnits": 1}),
            ("post", f"/api/plans/{uuid.uuid4()}/approve", {"actorId": "viewer"}),
            ("post", f"/api/imports/{uuid.uuid4()}/commit", {"idempotencyKey": "k"}),
        ],
    )
    def test_viewer_mutation_is_403(self, viewer_client: TestClient, method, path, payload):
        resp = viewer_client.request(method, path, json=payload)
        assert resp.status_code == 403, (path, resp.status_code, resp.text)
        assert resp.json()["detail"]["code"] == "forbidden"

    def test_viewer_can_read(self, viewer_client: TestClient):
        assert viewer_client.get("/api/orders").status_code == 200
        assert viewer_client.get("/api/plans").status_code == 200


class TestOperatorRole:
    """Operator may import/edit plan lines and edit store region, but not approve."""

    def test_operator_may_update_store_region(self, operator_client: TestClient):
        version = operator_client.get("/api/store").json()["store"]["version"]
        resp = operator_client.post("/api/store", json={"locale": "en", "expectedVersion": version})
        assert resp.status_code == 200, resp.text

    def test_operator_cannot_approve(self, operator_client: TestClient, fresh_plan_id: str):
        resp = operator_client.post(
            f"/api/plans/{fresh_plan_id}/approve", json={"actorId": "operator"}
        )
        assert resp.status_code == 403
