"""POST /api/ai/ask with an optional uploaded context file.

Rules under test: file figures are quoted only when labelled in the answer as
file content ("from your upload"), `file.` citations must be verbatim in the
extracted text, oversized/binary/unknown files are rejected with a clear 400,
and — zero-mutation invariant — a successful multipart ask changes no database
rows."""

from __future__ import annotations

import asyncio
import json
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.models import Plan, Product, Supplier
from app.services import ask as ask_module


def _provider(result: str) -> Any:
    class _P:
        prompts: list[str] = []

        def generate(self, prompt: str, timeout: int) -> str:  # noqa: ANN001 (test shim)
            self.prompts.append(prompt)
            return result

    return _P()


def _patch(monkeypatch: Any, provider: Any) -> None:
    monkeypatch.setattr(ask_module, "select_provider", lambda settings: (provider, None))


def _payload(answer: str, citations: list[dict[str, str]]) -> str:
    return json.dumps({"answer": answer, "citations": citations, "proposals": []})


def _csv_files(content: bytes, filename: str = "inventory.csv") -> dict[str, Any]:
    return {"file": (filename, content, "text/csv")}


def _multipart_ask(
    client: TestClient,
    monkeypatch: Any,
    result: str,
    question: str = "How are we doing?",
    files: dict[str, Any] | None = None,
) -> Any:
    provider = _provider(result)
    _patch(monkeypatch, provider)
    data = {"question": question}
    if files is None:
        files = _csv_files(b"stock,planned\n7,pick up\n")
    return client.post("/api/ai/ask", data=data, files=files)


def test_prompt_includes_agents_and_souls_files(client: TestClient, monkeypatch: Any) -> None:
    """Prompt wires both shipped files verbatim, ahead of the snapshot contract."""
    prompt_holder = _provider(
        json.dumps({"answer": "answer not important", "citations": [], "proposals": []})
    )
    _patch(monkeypatch, prompt_holder)
    client.post("/api/ai/ask", json={"question": "How is oat milk doing?"})

    assert "Advisory only." in prompt_holder.prompts[0]
    assert "Numbers first, reasoning second." in prompt_holder.prompts[0]


def test_csv_upload_file_citation_and_labelled_figure_pass(
    client: TestClient, monkeypatch: Any
) -> None:
    prompt_holder = _provider(
        _payload(
            "The csv lists 7 cases from your upload — worth a restock look.",
            [{"field": "file.stock", "value": "7"}],
        )
    )
    _patch(monkeypatch, prompt_holder)

    response = client.post(
        "/api/ai/ask",
        data={"question": "How much stock does the sheet say?"},
        files=_csv_files(b"stock,planned\n7,pick up\n"),
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["answer"] == "The csv lists 7 cases from your upload — worth a restock look."
    assert {"field": "file.stock", "value": "7"} in body["citations"]
    assert body["proposals"] == []
    prompt = prompt_holder.prompts[0]
    assert '<uploaded_file name="inventory.csv" kind="csv">' in prompt
    assert "stock: 7 | planned: pick up" in prompt


def test_unverifiable_figure_is_rejected_even_with_upload(
    client: TestClient, monkeypatch: Any
) -> None:
    response = _multipart_ask(
        client,
        monkeypatch,
        _payload(
            "The file reports total sales of 4321 units from your upload.",
            [{"field": "file.stock", "value": "7"}],
        ),
        files=_csv_files(b"stock,planned\n7,pick up\n"),
    )

    assert response.status_code == 502
    reason = response.json()["detail"]["reason"]
    assert reason.startswith("unverified-figure")
    assert "4321" in reason


def test_file_figure_without_labelling_phrase_rejected(
    client: TestClient, monkeypatch: Any
) -> None:
    oats = client.get("/api/products").json()
    product_id = oats[0]["id"]
    stock = oats[0]["risk"]["stock"]["value"]
    cover = oats[0]["risk"]["coverDays"]["value"]
    answer = (
        f"Oat milk has {stock} on hand with {cover} days of cover; "
        "the uploaded sheet says 4321 units on the shelf."
    )
    response = _multipart_ask(
        client,
        monkeypatch,
        _payload(
            answer,
            [
                {"field": f"products.{product_id}.stockQuantity", "value": str(stock)},
                {"field": f"products.{product_id}.coverDays", "value": str(cover)},
                {"field": "file.stock", "value": "4321"},
            ],
        ),
        files=_csv_files(b"stock,planned\n4321,restock\n"),
    )

    assert response.status_code == 502
    reason = response.json()["detail"]["reason"]
    assert reason.startswith("unverified-figure")


def test_oversize_and_binary_uploads_get_clear_400(client: TestClient, monkeypatch: Any) -> None:
    response = _multipart_ask(  # oversize valid csv
        client,
        monkeypatch,
        _payload("x", [{"field": "file.stock", "value": "7"}]),
        files=_csv_files(b"stock,planned\n" + b"A" * (ask_module.MAX_UPLOAD_BYTES + 1)),
    )
    assert response.status_code == 400
    assert "200 KB" in response.json()["detail"]["message"]

    response = _multipart_ask(  # unknown extension.
        client,
        monkeypatch,
        _payload("x", [{"field": "file.stock", "value": "7"}]),
        files=_csv_files(b"MZ", filename="payload.exe"),
    )
    assert response.status_code == 400
    assert response.json()["detail"]["message"].count(".txt") >= 1

    response = _multipart_ask(  # nul-byte sniff: binary under a text-ish name
        client,
        monkeypatch,
        _payload("x", [{"field": "file.stock", "value": "7"}]),
        files=_csv_files(b"\x00\x00", filename="weird.csv"),
    )
    assert response.status_code == 400
    assert response.json()["detail"]["message"].count(".txt") >= 1


def test_multipart_ask_changes_no_state(client: TestClient, monkeypatch: Any) -> None:
    """The file is context only: no Product/Supplier/Plan row moves."""
    oat = next(p for p in client.get("/api/products").json() if p["sku"] == "SKU-001")
    plans = client.get("/api/plans").json()
    line = next(
        ln
        for ln in client.get(f"/api/plans/{plans[0]['id']}").json()["lines"]
        if ln["sku"] == "SKU-001"
    )
    units = line["originalSuggestedBaseUnits"]
    provider = _provider(
        json.dumps(
            {
                "answer": f"The plan lists {units} units for oat milk; your upload says 7 on hand.",
                "citations": [
                    {
                        "field": f"plan.lines.{oat['id']}.originalSuggestedBaseUnits",
                        "value": str(units),
                    },
                    {"field": "file.stock", "value": "7"},
                ],
                "proposals": [],
            }
        )
    )
    _patch(monkeypatch, provider)

    async def _counts() -> tuple[int, int, int]:
        engine = create_async_engine(client.app.state.settings.database_url)
        try:
            factory = async_sessionmaker(engine, expire_on_commit=False)
            async with factory() as session:
                products = (
                    await session.execute(select(func.count()).select_from(Product))
                ).scalar_one()
                suppliers = (
                    await session.execute(select(func.count()).select_from(Supplier))
                ).scalar_one()
                plans = (await session.execute(select(func.count()).select_from(Plan))).scalar_one()
                return (products, suppliers, plans)
        finally:
            await engine.dispose()

    before = asyncio.run(_counts())
    response = client.post(
        "/api/ai/ask",
        data={"question": "How much oat milk does the upload say?"},
        files=_csv_files(b"stock,planned\n7,pick up\n"),
    )
    after = asyncio.run(_counts())

    assert response.status_code == 200
    assert before == after


def test_multipart_requires_question(client: TestClient, monkeypatch: Any) -> None:
    provider = _provider("{}")
    _patch(monkeypatch, provider)
    response = client.post(
        "/api/ai/ask", data={"not_question": "x"}, files=_csv_files(b"stock\n7\n")
    )
    assert response.status_code == 422


def test_file_citation_without_attachment_rejected(client: TestClient, monkeypatch: Any) -> None:
    """JSON path: the model may not cite `file.*` when no file was uploaded."""
    oats = client.get("/api/products").json()
    product_id = oats[0]["id"]
    stock = oats[0]["risk"]["stock"]["value"]
    provider = _provider(
        json.dumps(
            {
                "answer": f"Oat milk has {stock} on hand.",
                "citations": [
                    {"field": f"products.{product_id}.stockQuantity", "value": str(stock)},
                    {"field": "file.leadTimeDays", "value": "7"},
                ],
                "proposals": [],
            }
        )
    )
    _patch(monkeypatch, provider)

    response = client.post("/api/ai/ask", json={"question": "How are we doing?"})

    assert response.status_code == 502
    reason = response.json()["detail"]["reason"]
    assert reason.startswith("citation-file-without-file")
