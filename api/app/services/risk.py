"""Derived risk view assembly. Deterministic states only; see domain.calculations."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.calculations import (
    cover_days,
    delivery_estimate,
    delivery_gap_days,
    derive_risk_state,
    estimated_depletion_date,
    is_stale,
    quantize_quantity,
    ratio,
)
from app.models import PurchasingPolicy, Store
from app.schemas import (
    CoverFinite,
    CoverNoRecentSales,
    CoverUnavailable,
    DeliveryKnown,
    DeliveryUnavailable,
    DemandKnown,
    DemandUnavailable,
    DepletionKnown,
    DepletionUnavailable,
    GapFinite,
    GapUnavailable,
    InventoryRiskView,
    Issue,
    LeadKnown,
    LeadUnavailable,
    SalesMeasured,
    SalesMissing,
    SalesZeroVerified,
    SourceVersions,
    StockKnown,
    StockUnknown,
)
from app.services.inputs import (
    CatalogInputs,
    ProductInputs,
    assess_demand,
    assess_stock,
    load_catalog,
)


async def build_risk_views(
    session: AsyncSession, store: Store, policy: PurchasingPolicy, today: date
) -> tuple[CatalogInputs, dict[str, InventoryRiskView]]:
    catalog = await load_catalog(session, store, policy, today)
    views = {
        item.product.id: build_risk_view(item, catalog, policy, today) for item in catalog.items
    }
    return catalog, views


def build_risk_view(
    item: ProductInputs, catalog: CatalogInputs, policy: PurchasingPolicy, today: date
) -> InventoryRiskView:
    product = item.product
    terms = item.terms
    supplier = item.supplier
    snapshot = item.snapshot

    stock = assess_stock(item)
    demand = assess_demand(item, catalog.window_start, catalog.window_end)
    blockers: list[Issue] = []
    warnings: list[Issue] = []
    stock_state: StockKnown | StockUnknown
    sales_state: SalesMeasured | SalesZeroVerified | SalesMissing
    demand_state: DemandKnown | DemandUnavailable
    cover_state: CoverFinite | CoverNoRecentSales | CoverUnavailable
    lead_state: LeadKnown | LeadUnavailable
    depletion: DepletionKnown | DepletionUnavailable
    delivery: DeliveryKnown | DeliveryUnavailable

    # ---- stock (known | unknown; unknown is never zero)
    if stock.known and stock.value is not None and snapshot is not None:
        stock_state = StockKnown(value=stock.value, unit=product.base_unit, asOf=snapshot.as_of)
    else:
        stock_state = StockUnknown(reason=stock.reason or "stock quantity unknown")
        blockers.append(Issue(code="stock_unknown", message=f"{product.sku}: {stock.reason}"))

    # ---- sales (measured | zeroVerified | missing)
    if demand.kind == "measured" and demand.value is not None:
        sales_state = SalesMeasured(
            total=quantize_quantity(demand.value, product.quantity_precision),
            coveredDays=demand.observed_days,
            windowStart=demand.window_start,
            windowEnd=demand.window_end,
        )
        demand_state = DemandKnown(value=ratio(demand.average or Decimal(0)))
    elif demand.kind == "zeroVerified":
        sales_state = SalesZeroVerified(
            coveredDays=demand.observed_days,
            windowStart=demand.window_start,
            windowEnd=demand.window_end,
        )
        demand_state = DemandKnown(value=Decimal(0))
    else:
        sales_state = SalesMissing(reason=demand.reason or "sales history unavailable")
        demand_state = DemandUnavailable(reason=demand.reason or "sales history unavailable")
        blockers.append(
            Issue(code="sales_history_missing", message=f"{product.sku}: {demand.reason}")
        )

    # ---- cover days (finite | noRecentSales | unavailable)
    cover_value: Decimal | None = None
    if stock.known and stock.value is not None:
        if demand.kind == "measured" and demand.value is not None:
            cover_value = cover_days(stock.value, demand.average or Decimal(0))
            cover_state = CoverFinite(value=ratio(cover_value))
        elif demand.kind == "zeroVerified":
            cover_state = CoverNoRecentSales(
                reason="verified zero sales in the demand window — cover is not a number"
            )
        else:
            cover_state = CoverUnavailable(reason="sales history unavailable")
    else:
        cover_state = CoverUnavailable(reason="stock quantity unknown")

    # ---- lead time (from supplier terms; carries termsVersion)
    lead_days: int | None = None
    if terms is not None and supplier is not None:
        lead_days = terms.lead_time_value
        lead_state = LeadKnown(
            value=terms.lead_time_value,
            unit=terms.lead_time_unit,
            termsVersion=terms.version,
            calendarConfirmed=supplier.delivery_days is not None,
        )
    else:
        lead_state = LeadUnavailable(reason="no supplier terms on record")
        blockers.append(
            Issue(code="supplier_terms_missing", message=f"{product.sku}: no supplier terms")
        )

    # ---- staleness (each source judged independently)
    stale = False
    if snapshot is not None and is_stale(snapshot.as_of, today, policy.freshness_days):
        stale = True
    if item.last_sales_date is not None and is_stale(
        item.last_sales_date, today, policy.freshness_days
    ):
        stale = True

    # ---- estimated depletion
    if (
        stock.known
        and stock.value is not None
        and snapshot is not None
        and demand.kind == "measured"
        and demand.value is not None
        and (demand.average or Decimal(0)) > 0
    ):
        depletion = DepletionKnown(
            date=estimated_depletion_date(snapshot.as_of, stock.value, demand.average or Decimal(0))
        )
    else:
        reason = (
            "stock quantity unknown"
            if not stock.known
            else "verified zero sales — no depletion date"
            if demand.kind == "zeroVerified"
            else "sales history unavailable"
        )
        depletion = DepletionUnavailable(reason=reason)

    # ---- delivery estimate (calendar lower bound; never a confirmed slot)
    if terms is not None and supplier is not None:
        estimate = delivery_estimate(today, terms.lead_time_value, supplier.delivery_days)
        delivery = DeliveryKnown(
            date=estimate.estimate_date, confirmed=estimate.confirmed, reason=estimate.reason
        )
        warnings.append(
            Issue(code="delivery_estimate_unconfirmed", message=f"{product.sku}: {estimate.reason}")
        )
    else:
        delivery = DeliveryUnavailable(reason="no supplier terms on record")

    # ---- delivery gap (lower bound: lead time minus cover)
    gap: GapFinite | GapUnavailable
    if cover_value is not None and lead_days is not None:
        gap = GapFinite(value=ratio(delivery_gap_days(cover_value, lead_days)))
    else:
        gap = GapUnavailable(reason="cover or lead time unavailable")

    # ---- risk state (policy ordering: unknown > out-of-stock > stale > zero > cover)
    risk_state = derive_risk_state(
        stock=stock.value if stock.known else None,
        demand_kind=demand.kind,
        cover=cover_value,
        lead_days=lead_days,
        target_days=policy.target_days,
        stale=stale,
    )
    if stale:
        warnings.append(
            Issue(
                code="stale_source",
                message=(
                    f"{product.sku}: source data older than {policy.freshness_days} days "
                    "— revalidate"
                ),
            )
        )
    if demand.kind == "zeroVerified":
        warnings.append(
            Issue(code="no_recent_sales", message=f"{product.sku}: verified zero sales in window")
        )

    return InventoryRiskView(
        productId=product.id,
        sku=product.sku,
        name=product.name,
        category=product.category,
        baseUnit=product.base_unit,
        stock=stock_state,
        sales=sales_state,
        averageDailyDemand=demand_state,
        coverDays=cover_state,
        leadTime=lead_state,
        estimatedDepletion=depletion,
        deliveryEstimate=delivery,
        deliveryGap=gap,
        riskState=risk_state,
        blockers=blockers,
        warnings=warnings,
        sourceVersions=SourceVersions(
            stockSnapshotId=snapshot.id if snapshot else None,
            salesThrough=item.last_sales_date,
            termsVersion=terms.version if terms else None,
            policyVersion=policy.policy_version,
        ),
    )
