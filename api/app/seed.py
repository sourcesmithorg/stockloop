"""Idempotent fixture seed (T-11/T-13/T-14 arithmetic, pinned to 2026-10-13).

Creates: 1 store + policy + USD budget, 2 suppliers, 4 products, supplier terms,
13 days of sales (Sep 30 - Oct 12, 2026), stock snapshots (as of 2026-10-13),
one restock plan (48/30/96/48 units = USD 384.00), and its approval with the two
template documents PO-2026-0142 / PO-2026-0143.

Run:  uv run python -m app.seed
Safe to re-run: every row is created at most once.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Any
from uuid import NAMESPACE_URL, uuid5

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings
from app.models import (
    Approval,
    Membership,
    Plan,
    Preference,
    Product,
    ProductSupplierTerms,
    PurchasingPolicy,
    SalesRecord,
    StockSnapshot,
    Store,
    StoreBudget,
    Supplier,
    User,
)
from app.services.auth import hash_password
from app.services.plans import approve_plan, build_plan

FIXTURE_TODAY = date(2026, 10, 13)
DEMAND_WINDOW_START = date(2026, 9, 30)

_NS = uuid5(NAMESPACE_URL, "stockloop/seed/v1")


def _id(kind: str, key: str) -> str:
    return str(uuid5(_NS, f"{kind}:{key}"))


STORE_ID = _id("store", "maple-main")
POLICY_VERSION = "2026-10-13.v1"
FIXTURE_USER_ID = _id("user", "fixture-owner")
FIXTURE_OWNER_EMAIL = "owner@stockloop.test"
# Demo fixture account (not a real credential); hashed, never plaintext.
FIXTURE_OWNER_PASSWORD = "Stockloop123!"

SUPPLIERS: list[dict[str, Any]] = [
    {
        "id": _id("supplier", "SUP-001"),
        "code": "SUP-001",
        "name": "Freshfield Foods",
        "contact_email": "supply@example.test",
        "lead_time_days": 5,
        # Mon-Fri regular delivery window (stated in the delivered fixture).
        "delivery_days": [0, 1, 2, 3, 4],
        "last_verified_at": FIXTURE_TODAY,
    },
    {
        "id": _id("supplier", "SUP-002"),
        "code": "SUP-002",
        "name": "Daily Goods Co.",
        "contact_email": "orders@example.test",
        "lead_time_days": 3,
        # No delivery calendar on record: estimates are calendar bounds only.
        "delivery_days": None,
        "last_verified_at": FIXTURE_TODAY,
    },
]

# sku, name, category, supplier, unit cost, pack, MOQ, terms lead, stock, sales series
PRODUCTS: list[dict[str, Any]] = [
    {
        "sku": "SKU-001",
        "name": "Oat milk 1 L",
        "category": "Dairy",
        "supplier": "SUP-001",
        "unit_cost": Decimal("2.50"),
        "pack": 12,
        "moq": Decimal("24"),
        "lead": 5,
        "stock": Decimal("12"),
        "sales": [3, 4, 2, 5, 4, 6, 4, 3, 5, 4, 3, 5, 4],  # 52 total, avg 4/day
    },
    {
        "sku": "SKU-002",
        "name": "Jasmine rice 1 kg",
        "category": "Pantry",
        "supplier": "SUP-001",
        "unit_cost": Decimal("4.00"),
        "pack": 6,
        "moq": Decimal("30"),
        "lead": 3,
        "stock": Decimal("18"),
        "sales": [3, 3, 4, 2, 3, 3, 4, 3, 2, 3, 3, 3, 3],  # 39 total, avg 3/day
    },
    {
        "sku": "SKU-003",
        "name": "Instant noodles 85 g",
        "category": "Pantry",
        "supplier": "SUP-002",
        "unit_cost": Decimal("0.75"),
        "pack": 24,
        "moq": Decimal("48"),
        "lead": 5,
        "stock": Decimal("32"),
        "sales": [8, 9, 7, 8, 8, 10, 7, 8, 8, 7, 8, 8, 8],  # 104 total, avg 8/day
    },
    {
        "sku": "SKU-004",
        "name": "Sparkling water 500 ml",
        "category": "Beverages",
        "supplier": "SUP-002",
        "unit_cost": Decimal("1.50"),
        "pack": 12,
        "moq": Decimal("24"),
        "lead": 2,
        "stock": Decimal("24"),
        "sales": [6, 7, 5, 6, 6, 7, 5, 6, 7, 5, 6, 6, 6],  # 78 total, avg 6/day
    },
]


async def seed(session: AsyncSession) -> dict[str, object]:
    """Create every fixture row if absent; report what was created this run."""
    created: dict[str, int] = {}

    store = await session.get(Store, STORE_ID)
    if store is None:
        store = Store(
            id=STORE_ID,
            name="Maple & Main",
            country_code="US",
            locale="en",
            default_currency="USD",
            timezone="America/New_York",
            version=1,
            # Fixture: template documents start at PO-2026-0142.
            document_seq=141,
            created_at=datetime.now(UTC),
        )
        session.add(store)
        created["store"] = 1
    assert store is not None

    policy = await session.get(PurchasingPolicy, STORE_ID)
    if policy is None:
        session.add(
            PurchasingPolicy(
                store_id=STORE_ID,
                demand_window_days=13,
                target_days=7,
                safety_days=2,
                freshness_days=7,
                policy_version=POLICY_VERSION,
                version=1,
            )
        )
        created["policy"] = 1

    if await session.get(StoreBudget, (STORE_ID, "USD")) is None:
        session.add(StoreBudget(store_id=STORE_ID, currency="USD", amount=Decimal("500.00")))
        created["budget"] = 1
    # Demo fixture owner (owner@stockloop.test) — created idempotently so the
    # test client can authenticate against the seeded store. Hashed password.
    owner = await session.get(User, FIXTURE_USER_ID)
    if owner is None:
        owner = User(
            id=FIXTURE_USER_ID,
            email=FIXTURE_OWNER_EMAIL,
            password_hash=hash_password(FIXTURE_OWNER_PASSWORD),
            created_at=datetime.now(UTC),
        )
        session.add(owner)
        created["owner"] = 1
    if await session.get(Membership, (STORE_ID, FIXTURE_USER_ID)) is None:
        session.add(
            Membership(
                store_id=STORE_ID,
                user_id=FIXTURE_USER_ID,
                role="owner",
                status="active",
                version=1,
            )
        )
        created["membership"] = 1
    if await session.get(Preference, (STORE_ID, FIXTURE_USER_ID)) is None:
        session.add(Preference(store_id=STORE_ID, user_id=FIXTURE_USER_ID, version=1))
        created["preference"] = 1

    supplier_ids: dict[str, str] = {}
    for row in SUPPLIERS:
        supplier_id = str(row["id"])
        supplier_ids[str(row["code"])] = supplier_id
        if await session.get(Supplier, supplier_id) is None:
            session.add(
                Supplier(
                    id=supplier_id,
                    store_id=STORE_ID,
                    code=str(row["code"]),
                    name=str(row["name"]),
                    contact_email=str(row["contact_email"]),
                    document_currency="USD",
                    lead_time_days=int(row["lead_time_days"]),
                    delivery_days=row["delivery_days"],
                    last_verified_at=row["last_verified_at"],
                    version=1,
                )
            )
            created["supplier"] = created.get("supplier", 0) + 1
    await session.flush()

    existing_sales = {
        (row.product_id, row.business_date)
        for row in (
            await session.execute(select(SalesRecord).where(SalesRecord.store_id == STORE_ID))
        ).scalars()
    }

    for spec in PRODUCTS:
        sku = str(spec["sku"])
        product_id = _id("product", sku)
        supplier_id = supplier_ids[str(spec["supplier"])]

        if await session.get(Product, product_id) is None:
            session.add(
                Product(
                    id=product_id,
                    store_id=STORE_ID,
                    sku=sku,
                    name=str(spec["name"]),
                    category=str(spec["category"]),
                    base_unit="each",
                    quantity_precision=0,
                    status="active",
                )
            )
            created["product"] = created.get("product", 0) + 1

        terms_id = _id("terms", sku)
        if await session.get(ProductSupplierTerms, terms_id) is None:
            session.add(
                ProductSupplierTerms(
                    id=terms_id,
                    store_id=STORE_ID,
                    product_id=product_id,
                    supplier_id=supplier_id,
                    unit_cost=spec["unit_cost"],
                    purchase_pack_units=int(spec["pack"]),
                    minimum_order_units=spec["moq"],
                    lead_time_value=int(spec["lead"]),
                    lead_time_unit="calendarDays",
                    version=1,
                )
            )
            created["terms"] = created.get("terms", 0) + 1

        snapshot_id = _id("stock", f"{sku}:{FIXTURE_TODAY.isoformat()}")
        if await session.get(StockSnapshot, snapshot_id) is None:
            session.add(
                StockSnapshot(
                    id=snapshot_id,
                    store_id=STORE_ID,
                    product_id=product_id,
                    quantity=spec["stock"],
                    base_unit="each",
                    as_of=FIXTURE_TODAY,
                    imported_at=datetime.now(UTC),
                    source_version="fixture-v1",
                )
            )
            created["snapshot"] = created.get("snapshot", 0) + 1

        for offset, quantity in enumerate(spec["sales"]):
            business_date = DEMAND_WINDOW_START + timedelta(days=offset)
            if (product_id, business_date) in existing_sales:
                continue
            session.add(
                SalesRecord(
                    id=_id("sale", f"{sku}:{business_date.isoformat()}"),
                    store_id=STORE_ID,
                    product_id=product_id,
                    business_date=business_date,
                    quantity_sold=Decimal(quantity),
                    source_key="fixture-v1",
                    source_version="fixture-v1",
                )
            )
            existing_sales.add((product_id, business_date))
            created["sale"] = created.get("sale", 0) + 1

    await session.flush()

    # Plan + approval: created once; partial state (plan without approval) is healed.
    plan = await session.get(Plan, PLAN_ID)
    if plan is None:
        plan = await build_plan(session, store, FIXTURE_TODAY, plan_id=PLAN_ID)
        created["plan"] = 1
    await session.flush()

    active_approval = (
        (
            await session.execute(
                select(Approval).where(Approval.plan_id == PLAN_ID, Approval.status == "active")
            )
        )
        .scalars()
        .first()
    )
    approved = False
    if active_approval is None and plan.version == 1:
        await approve_plan(
            session,
            store,
            plan,
            expected_version=1,
            acknowledged_warnings=[],
            actor_id="owner",
            today=FIXTURE_TODAY,
        )
        approved = True

    await session.flush()
    return {
        "created": created,
        "planId": plan.id,
        "approved": approved,
    }


PLAN_ID = _id("plan", "fixture-restock")


async def run(database_url: str | None = None) -> dict[str, object]:
    url = database_url or get_settings().database_url
    engine = create_async_engine(url)
    try:
        factory = async_sessionmaker(engine, expire_on_commit=False)
        async with factory() as session:
            summary = await seed(session)
            await session.commit()
        return summary
    finally:
        await engine.dispose()


def main() -> None:
    summary = asyncio.run(run())
    print("StockLoop seed complete")
    print(f"  store id:    {STORE_ID}")
    print(f"  plan id:     {summary['planId']}")
    print(f"  approved:    {summary['approved']}")
    created = summary["created"]
    if created:
        print(f"  created:     {created}")
    else:
        print("  created:     nothing (all fixture rows already present)")


if __name__ == "__main__":
    main()
