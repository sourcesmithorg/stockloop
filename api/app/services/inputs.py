"""Catalog/source-data loading shared by risk and plan services.

Unknown is never zero: assessments carry an explicit kind plus a reason.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.calculations import (
    average_daily_demand,
    quantize_quantity,
    require_finite_nonnegative,
)
from app.models import (
    Product,
    ProductSupplierTerms,
    PurchasingPolicy,
    SalesRecord,
    StockSnapshot,
    Store,
    Supplier,
)


@dataclass(frozen=True)
class ProductInputs:
    product: Product
    terms: ProductSupplierTerms | None
    supplier: Supplier | None
    snapshot: StockSnapshot | None
    observed_days: int
    sales_total: Decimal
    last_sales_date: date | None


@dataclass(frozen=True)
class DemandAssessment:
    # measured | zeroVerified | missing
    kind: str
    value: Decimal | None
    observed_days: int
    reason: str | None
    window_start: date
    window_end: date

    @property
    def average(self) -> Decimal | None:
        if self.kind != "measured" or self.value is None:
            return None
        return average_daily_demand(self.value, self.observed_days)


@dataclass(frozen=True)
class StockAssessment:
    known: bool
    value: Decimal | None
    reason: str | None


@dataclass(frozen=True)
class CatalogInputs:
    items: list[ProductInputs]
    window_start: date
    window_end: date


def demand_window(today: date, policy: PurchasingPolicy) -> tuple[date, date]:
    """Reporting window: the last N completed days, excluding today."""
    window_end = today - timedelta(days=1)
    window_start = window_end - timedelta(days=policy.demand_window_days - 1)
    return window_start, window_end


async def load_catalog(
    session: AsyncSession, store: Store, policy: PurchasingPolicy, today: date
) -> CatalogInputs:
    """One bounded query per table; results grouped in Python (store-scale data)."""
    window_start, window_end = demand_window(today, policy)

    products = list(
        (
            await session.execute(
                select(Product)
                .where(Product.store_id == store.id, Product.status == "active")
                .order_by(Product.sku)
            )
        ).scalars()
    )
    terms_rows = list(
        (
            await session.execute(
                select(ProductSupplierTerms).where(ProductSupplierTerms.store_id == store.id)
            )
        ).scalars()
    )
    suppliers = {
        row.id: row
        for row in (
            await session.execute(select(Supplier).where(Supplier.store_id == store.id))
        ).scalars()
    }
    # Latest snapshot per product (Postgres DISTINCT ON, ordered deterministically).
    snapshots = list(
        (
            await session.execute(
                select(StockSnapshot)
                .where(StockSnapshot.store_id == store.id)
                .order_by(
                    StockSnapshot.product_id,
                    StockSnapshot.as_of.desc(),
                    StockSnapshot.imported_at.desc(),
                )
                .distinct(StockSnapshot.product_id)
            )
        ).scalars()
    )
    snapshot_by_product = {row.product_id: row for row in snapshots}
    terms_by_product = {row.product_id: row for row in terms_rows}
    # Sales aggregate within the demand window (observed days = dates with a record).
    sales_rows = (
        await session.execute(
            select(
                SalesRecord.product_id,
                func.count(func.distinct(SalesRecord.business_date)).label("observed"),
                func.coalesce(func.sum(SalesRecord.quantity_sold), 0).label("total"),
                func.max(SalesRecord.business_date).label("last_date"),
            )
            .where(
                SalesRecord.store_id == store.id,
                SalesRecord.business_date >= window_start,
                SalesRecord.business_date <= window_end,
            )
            .group_by(SalesRecord.product_id)
        )
    ).all()
    sales_by_product = {row.product_id: row for row in sales_rows}

    items: list[ProductInputs] = []
    for product in products:
        agg = sales_by_product.get(product.id)
        terms = terms_by_product.get(product.id)
        items.append(
            ProductInputs(
                product=product,
                terms=terms,
                supplier=suppliers.get(terms.supplier_id) if terms else None,
                snapshot=snapshot_by_product.get(product.id),
                observed_days=int(agg.observed) if agg else 0,
                sales_total=Decimal(str(agg.total)) if agg else Decimal(0),
                last_sales_date=agg.last_date if agg else None,
            )
        )
    return CatalogInputs(items=items, window_start=window_start, window_end=window_end)


def assess_demand(item: ProductInputs, window_start: date, window_end: date) -> DemandAssessment:
    """measured | zeroVerified (complete window, verified total 0) | missing (never zero)."""
    window_days = (window_end - window_start).days + 1
    if item.observed_days == 0:
        return DemandAssessment(
            kind="missing",
            value=None,
            observed_days=0,
            reason="no sales records in the demand window",
            window_start=window_start,
            window_end=window_end,
        )
    if item.sales_total == 0:
        if item.observed_days >= window_days:
            return DemandAssessment(
                kind="zeroVerified",
                value=Decimal(0),
                observed_days=item.observed_days,
                reason=None,
                window_start=window_start,
                window_end=window_end,
            )
        return DemandAssessment(
            kind="missing",
            value=None,
            observed_days=item.observed_days,
            reason=(
                f"sales history incomplete: {item.observed_days} of {window_days} "
                "days observed, zero sales cannot be verified"
            ),
            window_start=window_start,
            window_end=window_end,
        )
    return DemandAssessment(
        kind="measured",
        value=item.sales_total,
        observed_days=item.observed_days,
        reason=None,
        window_start=window_start,
        window_end=window_end,
    )


def assess_stock(item: ProductInputs) -> StockAssessment:
    """Latest snapshot: known quantity (at product precision) or an explicit unknown reason."""
    snapshot = item.snapshot
    if snapshot is None:
        return StockAssessment(known=False, value=None, reason="no stock snapshot recorded")
    if snapshot.quantity is None:
        return StockAssessment(
            known=False, value=None, reason=snapshot.unknown_reason or "stock quantity unknown"
        )
    value = quantize_quantity(snapshot.quantity, item.product.quantity_precision)
    require_finite_nonnegative(value, "stock")
    return StockAssessment(known=True, value=value, reason=None)
