"""Plan construction, trusted recalculation, edit invalidation and approval.

Approval binds an immutable plan version; any relevant edit creates a new version
and marks prior approvals stale (T-19). Every total is recomputed by trusted code
from validated values — never accepted from the client.
"""

from __future__ import annotations

import hashlib
import json
from datetime import UTC, date, datetime
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import api_error, get_policy
from app.domain.calculations import (
    CalculationError,
    budget_remaining,
    budget_utilization_percent,
    delivery_estimate,
    quantize_money,
    quantize_quantity,
    ratio_str,
    require_finite_nonnegative,
    suggest_order,
    totals_by_currency,
)
from app.domain.calculations import (
    line_total as compute_line_total,
)
from app.models import (
    Approval,
    Plan,
    PlanLine,
    Product,
    ProductSupplierTerms,
    PurchaseOrder,
    Store,
    StoreBudget,
    Supplier,
)
from app.schemas import (
    ApprovalOut,
    BudgetStatus,
    Issue,
    OrderLineSnapshot,
    OrderSummary,
    PlanDetailOut,
    PlanLineOut,
    PlanSummaryOut,
    SupplierGroupOut,
)
from app.services.inputs import CatalogInputs, assess_demand, assess_stock, load_catalog

TAX_SHIPPING_WARNING = Issue(
    code="tax_shipping_excluded",
    message="Tax and shipping are excluded from plan totals — excluded, not zero.",
)


def effective_units(line: PlanLine) -> Decimal:
    return (
        line.edited_base_units
        if line.edited_base_units is not None
        else line.original_suggested_base_units
    )


async def load_plan(session: AsyncSession, store: Store, plan_id: str) -> Plan:
    plan = await session.get(Plan, plan_id)
    if plan is None or plan.store_id != store.id:
        raise api_error("plan_not_found", f"Plan {plan_id} not found", 404)
    return plan


def recompute_line(line: PlanLine, terms: ProductSupplierTerms | None) -> None:
    """Trusted recalculation of one line's cached total and constraint results."""
    units = effective_units(line)
    line.line_total = compute_line_total(units, line.unit_cost, line.currency)
    results: list[dict[str, object]] = [{"code": "nonnegative_quantity", "status": "pass"}]
    pack = line.purchase_pack_units
    if pack > 0 and units % pack == 0:
        results.append({"code": "pack_multiple", "status": "pass"})
    else:
        results.append(
            {
                "code": "pack_multiple",
                "status": "fail",
                "detail": f"{units} is not a multiple of the {pack}-unit purchase pack",
            }
        )
    if units == 0:
        results.append(
            {
                "code": "minimum_order_units",
                "status": "excluded",
                "detail": "quantity excluded by owner",
            }
        )
    elif terms is None:
        results.append(
            {"code": "minimum_order_units", "status": "fail", "detail": "no supplier terms"}
        )
    elif units >= terms.minimum_order_units:
        results.append({"code": "minimum_order_units", "status": "pass"})
    else:
        results.append(
            {
                "code": "minimum_order_units",
                "status": "fail",
                "detail": f"{units} units is below the {terms.minimum_order_units}-unit MOQ",
            }
        )
    line.constraint_results = results


def build_rule_trace(
    *,
    demand: Decimal,
    stock: Decimal,
    cover: Decimal | None,
    target_days: int,
    lead_days: int,
    safety_days: int,
    gross: Decimal,
    raw: Decimal,
    pack_size: int,
    minimum_order_units: Decimal,
    rounded_units: Decimal,
    pack_count: int,
    excess_units: Decimal,
    moq_applied: bool,
) -> dict[str, object]:
    """JSON-safe trace so the UI can explain every number (T-11/T-13)."""
    return {
        "demandPerDay": ratio_str(demand),
        "coverDays": ratio_str(cover) if cover is not None else None,
        "targetDays": target_days,
        "leadTimeDays": lead_days,
        "safetyDays": safety_days,
        "horizonDays": target_days + lead_days + safety_days,
        "grossTargetUnits": ratio_str(gross),
        "onHandUnits": ratio_str(stock),
        "rawRequiredUnits": ratio_str(raw),
        "minimumOrderUnits": ratio_str(minimum_order_units),
        "purchasePackUnits": pack_size,
        "roundedUnits": ratio_str(rounded_units),
        "purchasePackCount": pack_count,
        "excessUnits": ratio_str(excess_units),
        "moqApplied": moq_applied,
        "formula": "raw = max(0, d*(T+L+B) - S); units = P * ceil(max(raw, MOQ) / P)",
    }


def build_line_explanation(
    *,
    trace: dict[str, object],
    units: Decimal,
    pack_size: int,
    total: Decimal,
    currency: str,
    edited: bool,
) -> str:
    if edited:
        packs_now = int(units // pack_size) if pack_size > 0 else 0
        return (
            f"{units} units ({packs_now} packs of {pack_size}): quantity edited by the owner; "
            f"original suggestion was {trace['roundedUnits']} units; "
            f"line total {currency} {total}; "
            "approval invalidated by the edit."
        )
    horizon = trace["horizonDays"]
    parts = [
        f"{units} units ({trace['purchasePackCount']} packs of {pack_size}): "
        f"target {horizon} days x {trace['demandPerDay']}/day = {trace['grossTargetUnits']} gross, "
        f"less {trace['onHandUnits']} on hand = {trace['rawRequiredUnits']} raw",
        f"rounded to {trace['roundedUnits']} units for pack/MOQ rules",
        f"line total {currency} {total}",
    ]
    if trace["moqApplied"]:
        parts.append(f"MOQ {trace['minimumOrderUnits']} applied")
    return "; ".join(parts) + "."


async def _terms_for_products(
    session: AsyncSession, store: Store, product_ids: set[str]
) -> dict[str, ProductSupplierTerms]:
    if not product_ids:
        return {}
    rows = (
        await session.execute(
            select(ProductSupplierTerms).where(
                ProductSupplierTerms.store_id == store.id,
                ProductSupplierTerms.product_id.in_(product_ids),
            )
        )
    ).scalars()
    by_product: dict[str, ProductSupplierTerms] = {}
    for row in rows:
        by_product.setdefault(row.product_id, row)
    return by_product


async def build_plan(
    session: AsyncSession, store: Store, today: date, *, plan_id: str | None = None
) -> Plan:
    """Deterministic proposal for every product whose inputs are complete.

    Products with unknown stock/missing sales/missing terms are excluded and
    surface as plan-level blockers at read time — unknown is never zero.
    """
    policy = await get_policy(session, store)
    catalog = await load_catalog(session, store, policy, today)
    plan = Plan(
        id=plan_id or str(uuid4()),
        store_id=store.id,
        version=1,
        calculation_status="valid",
        review_status="draft",
        policy_version=policy.policy_version,
        source_versions={},
        explanation_source="rule-based",
    )
    session.add(plan)  # keep pending: line appends initialize the collection in memory

    position = 0
    terms_versions: dict[str, int] = {}
    stock_as_of: date | None = None
    for item in catalog.items:
        product, terms, supplier = item.product, item.terms, item.supplier
        if terms is None or supplier is None:
            continue
        demand = assess_demand(item, catalog.window_start, catalog.window_end)
        stock = assess_stock(item)
        if demand.kind == "missing" or not stock.known or stock.value is None:
            continue
        average = demand.average if demand.kind == "measured" else Decimal(0)
        suggestion = suggest_order(
            demand=average or Decimal(0),
            stock=stock.value,
            target_days=policy.target_days,
            lead_days=terms.lead_time_value,
            safety_days=policy.safety_days,
            pack_size=terms.purchase_pack_units,
            minimum_order_units=terms.minimum_order_units,
            unit_cost=terms.unit_cost,
            currency=supplier.document_currency,
        )
        rounding = suggestion.rounding
        cover = suggestion.cover
        line = PlanLine(
            id=str(uuid4()),
            plan_id=plan.id,
            product_id=product.id,
            supplier_id=supplier.id,
            selected=rounding.base_units > 0,
            original_suggested_base_units=rounding.base_units,
            edited_base_units=None,
            purchase_pack_units=terms.purchase_pack_units,
            unit_cost=terms.unit_cost,
            currency=supplier.document_currency,
            line_total=suggestion.total,
            terms_version=terms.version,
            rule_trace=build_rule_trace(
                demand=average or Decimal(0),
                stock=stock.value,
                cover=cover,
                target_days=policy.target_days,
                lead_days=terms.lead_time_value,
                safety_days=policy.safety_days,
                gross=suggestion.gross_target_units,
                raw=suggestion.raw_required_units,
                pack_size=terms.purchase_pack_units,
                minimum_order_units=terms.minimum_order_units,
                rounded_units=rounding.base_units,
                pack_count=rounding.pack_count,
                excess_units=rounding.excess_units,
                moq_applied=rounding.moq_applied,
            ),
            constraint_results=[],
            explanation="",
            position=position,
        )
        recompute_line(line, terms)
        if demand.kind == "zeroVerified":
            line.explanation = (
                "Verified zero sales in the demand window — no order suggested "
                "(an MOQ alone never creates a purchase)."
            )
        else:
            line.explanation = build_line_explanation(
                trace=line.rule_trace,
                units=rounding.base_units,
                pack_size=terms.purchase_pack_units,
                total=suggestion.total,
                currency=supplier.document_currency,
                edited=False,
            )
        plan.lines.append(line)  # cascade: session adds the line; keeps the collection loaded
        position += 1
        terms_versions[product.id] = terms.version
        if item.snapshot is not None and item.snapshot.as_of is not None:
            stock_as_of = (
                max(stock_as_of, item.snapshot.as_of) if stock_as_of else item.snapshot.as_of
            )
    plan.source_versions = {
        "salesThrough": catalog.window_end.isoformat(),
        "stockAsOf": stock_as_of.isoformat() if stock_as_of else None,
        "termsVersions": terms_versions,
    }
    return plan


async def _catalog_blockers(catalog: CatalogInputs, planned_ids: set[str]) -> list[Issue]:
    """Why a product is absent from the plan (inputs incomplete — never zero)."""
    blockers: list[Issue] = []
    for item in catalog.items:
        if item.product.id in planned_ids:
            continue
        sku = item.product.sku
        if item.terms is None or item.supplier is None:
            blockers.append(
                Issue(code="supplier_terms_missing", message=f"{sku}: no supplier terms")
            )
            continue
        stock = assess_stock(item)
        if not stock.known:
            blockers.append(Issue(code="stock_unknown", message=f"{sku}: {stock.reason}"))
        demand = assess_demand(item, catalog.window_start, catalog.window_end)
        if demand.kind == "missing":
            blockers.append(Issue(code="sales_history_missing", message=f"{sku}: {demand.reason}"))
    return blockers


async def plan_detail(
    session: AsyncSession, store: Store, plan: Plan, today: date
) -> PlanDetailOut:
    """Assemble the plan response. Totals recomputed from lines at read time."""
    policy = await get_policy(session, store)
    catalog = await load_catalog(session, store, policy, today)
    product_ids = {line.product_id for line in plan.lines}
    products = (
        {
            row.id: row
            for row in (
                await session.execute(
                    select(Product).where(Product.store_id == store.id, Product.id.in_(product_ids))
                )
            ).scalars()
        }
        if product_ids
        else {}
    )
    suppliers = {
        row.id: row
        for row in (
            await session.execute(select(Supplier).where(Supplier.store_id == store.id))
        ).scalars()
    }
    terms_by_product = await _terms_for_products(session, store, product_ids)

    lines_out: list[PlanLineOut] = []
    selected_pairs: list[tuple[str, Decimal]] = []
    selected_lines: list[PlanLine] = []
    blockers: list[Issue] = []
    group_totals: dict[str, Decimal] = {}

    for line in plan.lines:
        product = products.get(line.product_id)
        supplier = suppliers.get(line.supplier_id)
        precision = product.quantity_precision if product is not None else 0
        units = quantize_quantity(effective_units(line), precision)
        pack = line.purchase_pack_units
        packs = int(units // pack) if pack > 0 else 0
        total = compute_line_total(units, line.unit_cost, line.currency)
        if line.selected:
            selected_lines.append(line)
            selected_pairs.append((line.currency, total))
            group_totals[line.supplier_id] = group_totals.get(line.supplier_id, Decimal(0)) + total
            for result in line.constraint_results:
                if str(result.get("status")) == "fail":
                    blockers.append(
                        Issue(
                            code=f"line_{result.get('code')}",
                            message=(
                                f"{product.sku if product else line.product_id}: "
                                f"{result.get('detail', result.get('code'))}"
                            ),
                        )
                    )
            current_terms = terms_by_product.get(line.product_id)
            if current_terms is None:
                blockers.append(
                    Issue(
                        code="supplier_terms_missing",
                        message=(
                            f"{product.sku if product else line.product_id}: supplier terms removed"
                        ),
                    )
                )
            elif current_terms.version != line.terms_version:
                blockers.append(
                    Issue(
                        code="terms_stale",
                        message=(
                            f"{product.sku if product else line.product_id}: "
                            "supplier terms changed "
                            f"(v{line.terms_version} -> v{current_terms.version}) — "
                            "rebuild the plan"
                        ),
                    )
                )
        lines_out.append(
            PlanLineOut(
                id=line.id,
                productId=line.product_id,
                sku=product.sku if product else "unknown",
                productName=product.name if product else "unknown",
                supplierId=line.supplier_id,
                supplierName=supplier.name if supplier else "unknown",
                selected=line.selected,
                originalSuggestedBaseUnits=quantize_quantity(
                    line.original_suggested_base_units, precision
                ),
                editedBaseUnits=(
                    quantize_quantity(line.edited_base_units, precision)
                    if line.edited_base_units is not None
                    else None
                ),
                effectiveBaseUnits=units,
                purchasePackUnits=pack,
                purchasePackCount=packs,
                unitCost=quantize_money(line.unit_cost, line.currency),
                currency=line.currency,
                lineTotal=total,
                termsVersion=line.terms_version,
                ruleTrace=line.rule_trace,
                constraintResults=line.constraint_results,
                explanation=line.explanation,
            )
        )

    planned_ids = {line.product_id for line in plan.lines}
    blockers.extend(await _catalog_blockers(catalog, planned_ids))

    totals = totals_by_currency(selected_pairs)
    budget_rows = {
        row.currency: row.amount
        for row in (
            await session.execute(select(StoreBudget).where(StoreBudget.store_id == store.id))
        ).scalars()
    }
    currencies = sorted(set(totals) | set(budget_rows))
    budgets: list[BudgetStatus] = []
    for currency in currencies:
        budget = budget_rows.get(currency)
        total = totals.get(currency, Decimal(0))
        remaining = budget_remaining(budget, total, currency) if budget is not None else None
        utilization = (
            budget_utilization_percent(total, budget, currency)
            if budget is not None and budget > 0
            else None
        )
        budgets.append(
            BudgetStatus(
                currency=currency,
                budgetAmount=(quantize_money(budget, currency) if budget is not None else None),
                selectedTotal=total,
                remaining=remaining,
                utilizationPercent=utilization,
            )
        )

    warnings: list[Issue] = [TAX_SHIPPING_WARNING]
    for budget_status in budgets:
        if (
            budget_status.budgetAmount is not None
            and budget_status.selectedTotal > budget_status.budgetAmount
        ):
            shortfall = budget_status.budgetAmount - budget_status.selectedTotal
            warnings.append(
                Issue(
                    code="budget_exceeded",
                    message=(
                        f"{budget_status.currency}: selected {budget_status.selectedTotal} exceeds "
                        f"budget {budget_status.budgetAmount} by {shortfall} — "
                        "review, do not silently cut"
                    ),
                )
            )

    groups: list[SupplierGroupOut] = []
    for supplier_id, subtotal in sorted(
        group_totals.items(),
        key=lambda pair: suppliers[pair[0]].code if pair[0] in suppliers else "",
    ):
        supplier = suppliers.get(supplier_id)
        if supplier is None:
            continue
        line_count = sum(1 for line in selected_lines if line.supplier_id == supplier_id)
        groups.append(
            SupplierGroupOut(
                supplierId=supplier_id,
                supplierCode=supplier.code,
                supplierName=supplier.name,
                currency=supplier.document_currency,
                leadTimeDays=supplier.lead_time_days,
                lineCount=line_count,
                subtotal=subtotal,
            )
        )
        estimate = delivery_estimate(today, supplier.lead_time_days, supplier.delivery_days)
        warnings.append(
            Issue(
                code="delivery_estimate_unconfirmed",
                message=f"{supplier.name}: {estimate.reason}",
            )
        )

    calculation_status = (
        "blocked"
        if blockers
        else plan.calculation_status
        if plan.calculation_status in ("pending", "failed")
        else "valid"
    )
    active_approval = (
        (
            await session.execute(
                select(Approval)
                .where(
                    Approval.plan_id == plan.id,
                    Approval.plan_version == plan.version,
                    Approval.status == "active",
                )
                .order_by(Approval.approved_at.desc())
            )
        )
        .scalars()
        .first()
    )
    active_approval_out = (
        await approval_out(session, active_approval, suppliers) if active_approval else None
    )

    return PlanDetailOut(
        id=plan.id,
        storeId=store.id,
        version=plan.version,
        calculationStatus=calculation_status,
        reviewStatus=plan.review_status,
        policyVersion=plan.policy_version,
        explanationSource=plan.explanation_source,
        sourceVersions=plan.source_versions,
        totalsByCurrency=totals,
        budgets=budgets,
        supplierGroups=groups,
        lines=lines_out,
        blockers=blockers,
        warnings=warnings,
        activeApproval=active_approval_out,
        createdAt=plan.created_at,
        updatedAt=plan.updated_at,
    )


def order_summary(
    order: PurchaseOrder, supplier_name: str, approval_status: str | None
) -> OrderSummary:
    lines = order.lines if isinstance(order.lines, list) else []
    total_units = sum((Decimal(str(entry.get("baseUnits", "0"))) for entry in lines), Decimal(0))
    return OrderSummary(
        id=order.id,
        displayNumber=order.display_number,
        supplierId=order.supplier_id,
        supplierName=supplier_name,
        currency=order.currency,
        itemSubtotal=quantize_money(order.item_subtotal, order.currency),
        taxTreatment=order.tax_treatment,
        shippingTreatment=order.shipping_treatment,
        documentStatus=order.document_status,
        approvalId=order.approval_id,
        approvalStatus=approval_status,
        planId=order.plan_id,
        productCount=len(lines),
        totalUnits=total_units,
        createdAt=order.created_at,
    )


async def approval_out(
    session: AsyncSession, approval: Approval, suppliers: dict[str, Supplier]
) -> ApprovalOut:
    orders = list(
        (
            await session.execute(
                select(PurchaseOrder)
                .where(PurchaseOrder.approval_id == approval.id)
                .order_by(PurchaseOrder.display_number)
            )
        ).scalars()
    )
    return ApprovalOut(
        id=approval.id,
        planId=approval.plan_id,
        planVersion=approval.plan_version,
        contentDigest=approval.content_digest,
        actorId=approval.actor_id,
        approvedAt=approval.approved_at,
        status=approval.status,
        acknowledgedWarnings=[str(w) for w in approval.acknowledged_warnings],
        orders=[
            order_summary(
                order,
                suppliers[order.supplier_id].name if order.supplier_id in suppliers else "unknown",
                approval.status,
            )
            for order in orders
        ],
    )


async def edit_line(
    session: AsyncSession,
    store: Store,
    plan: Plan,
    line: PlanLine,
    *,
    units: Decimal,
    expected_version: int,
) -> Plan:
    """Owner quantity edit: pack-multiple only; bumps version; invalidates approval (T-19)."""
    if expected_version != plan.version:
        raise api_error(
            "stale_plan_version",
            f"Plan moved on: expected version {expected_version}, current is {plan.version}",
            409,
            currentVersion=plan.version,
        )
    try:
        require_finite_nonnegative(units, "editedBaseUnits")
    except CalculationError as exc:
        raise api_error("invalid_quantity", str(exc), 422) from exc
    pack = line.purchase_pack_units
    if pack <= 0:
        raise api_error("invalid_pack", "Line has no valid purchase pack", 422)
    if units % pack != 0:
        raise api_error(
            "off_pack_quantity",
            f"Quantity must be a multiple of the {pack}-unit purchase pack "
            f"(or 0 to exclude the line)",
            422,
            purchasePackUnits=pack,
        )
    terms = (await _terms_for_products(session, store, {line.product_id})).get(line.product_id)
    line.edited_base_units = units
    line.selected = units > 0
    recompute_line(line, terms)
    line.explanation = build_line_explanation(
        trace=line.rule_trace,
        units=units,
        pack_size=pack,
        total=line.line_total,
        currency=line.currency,
        edited=True,
    )

    plan.version += 1
    if plan.review_status == "approved":
        plan.review_status = "stale"
    actives = list(
        (
            await session.execute(
                select(Approval).where(Approval.plan_id == plan.id, Approval.status == "active")
            )
        ).scalars()
    )
    for approval in actives:
        approval.status = "stale"
        orders = (
            await session.execute(
                select(PurchaseOrder).where(PurchaseOrder.approval_id == approval.id)
            )
        ).scalars()
        for order in orders:
            order.document_status = "superseded"
    await session.flush()
    return plan


def _content_digest(plan: Plan, detail: PlanDetailOut) -> str:
    payload = {
        "planId": plan.id,
        "planVersion": plan.version,
        "policyVersion": plan.policy_version,
        "sourceVersions": plan.source_versions,
        "lines": [
            {
                "productId": line.productId,
                "units": str(line.effectiveBaseUnits),
                "packCount": line.purchasePackCount,
                "unitCost": str(line.unitCost),
                "currency": line.currency,
                "lineTotal": str(line.lineTotal),
            }
            for line in detail.lines
            if line.selected
        ],
        "totals": {code: str(total) for code, total in detail.totalsByCurrency.items()},
    }
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


async def approve_plan(
    session: AsyncSession,
    store: Store,
    plan: Plan,
    *,
    expected_version: int,
    acknowledged_warnings: list[str],
    actor_id: str,
    today: date,
) -> ApprovalOut:
    """Immutable approval for the exact current version; rejects stale/blocking states."""
    if expected_version != plan.version:
        raise api_error(
            "stale_plan_version",
            f"Plan moved on: expected version {expected_version}, current is {plan.version}",
            409,
            currentVersion=plan.version,
        )
    detail = await plan_detail(session, store, plan, today)
    if detail.blockers:
        raise api_error(
            "blocking_constraints",
            "Plan has blocking constraints",
            422,
            blockers=[{"code": issue.code, "message": issue.message} for issue in detail.blockers],
        )
    if detail.calculationStatus != "valid":
        raise api_error(
            "calculation_not_valid",
            f"Plan calculation is {detail.calculationStatus} — cannot approve",
            422,
            calculationStatus=detail.calculationStatus,
        )
    suppliers = {
        row.id: row
        for row in (
            await session.execute(select(Supplier).where(Supplier.store_id == store.id))
        ).scalars()
    }

    # Idempotent: same version already approved -> return the existing approval.
    existing = (
        (
            await session.execute(
                select(Approval)
                .where(
                    Approval.plan_id == plan.id,
                    Approval.plan_version == plan.version,
                    Approval.status == "active",
                )
                .order_by(Approval.approved_at.desc())
            )
        )
        .scalars()
        .first()
    )
    if existing is not None:
        return await approval_out(session, existing, suppliers)

    # Any remaining active approvals are for older versions: mark stale, supersede orders.
    stale_rows = (
        await session.execute(
            select(Approval).where(Approval.plan_id == plan.id, Approval.status == "active")
        )
    ).scalars()
    for approval in stale_rows:
        approval.status = "stale"
        orders = (
            await session.execute(
                select(PurchaseOrder).where(PurchaseOrder.approval_id == approval.id)
            )
        ).scalars()
        for order in orders:
            order.document_status = "superseded"

    now = datetime.now(UTC)
    approval = Approval(
        id=str(uuid4()),
        store_id=store.id,
        plan_id=plan.id,
        plan_version=plan.version,
        content_digest=_content_digest(plan, detail),
        source_versions=plan.source_versions,
        terms_versions={line.productId: line.termsVersion for line in detail.lines},
        policy_version=plan.policy_version,
        actor_id=actor_id,
        approved_at=now,
        acknowledged_warnings=acknowledged_warnings,
        status="active",
    )
    session.add(approval)
    await session.flush()

    # One immutable document per supplier group; sequence continues store document history.
    selected_lines = [line for line in detail.lines if line.selected]
    for group in detail.supplierGroups:
        store.document_seq += 1
        display_number = f"PO-{now.year}-{store.document_seq:04d}"
        group_lines = [line for line in selected_lines if line.supplierId == group.supplierId]
        snapshot: list[dict[str, object]] = [
            OrderLineSnapshot(
                productId=line.productId,
                sku=line.sku,
                productName=line.productName,
                supplierId=line.supplierId,
                baseUnits=line.effectiveBaseUnits,
                purchasePackUnits=line.purchasePackUnits,
                purchasePackCount=line.purchasePackCount,
                unitCost=line.unitCost,
                currency=line.currency,
                lineTotal=line.lineTotal,
            ).model_dump(mode="json")
            for line in group_lines
        ]
        supplier = suppliers.get(group.supplierId)
        session.add(
            PurchaseOrder(
                id=str(uuid4()),
                store_id=store.id,
                display_number=display_number,
                supplier_id=group.supplierId,
                currency=group.currency,
                lines=snapshot,
                item_subtotal=group.subtotal,
                tax_treatment="excluded",
                shipping_treatment="excluded",
                approval_id=approval.id,
                plan_id=plan.id,
                document_status="approved",
                supplier_snapshot={
                    "code": supplier.code if supplier else None,
                    "name": supplier.name if supplier else None,
                    "contactEmail": supplier.contact_email if supplier else None,
                    "documentCurrency": supplier.document_currency if supplier else None,
                },
            )
        )

    plan.review_status = "approved"
    plan.calculation_status = "valid"
    await session.flush()
    return await approval_out(session, approval, suppliers)


async def plan_summaries(session: AsyncSession, store: Store) -> list[PlanSummaryOut]:
    plans = list(
        (
            await session.execute(
                select(Plan).where(Plan.store_id == store.id).order_by(Plan.created_at.desc())
            )
        ).scalars()
    )
    plan_ids = [plan.id for plan in plans]
    approval_query = select(Approval).where(
        Approval.store_id == store.id, Approval.status == "active"
    )
    if plan_ids:
        approval_query = approval_query.where(Approval.plan_id.in_(plan_ids))
    approvals = list((await session.execute(approval_query)).scalars())
    active_by_plan = {approval.plan_id: approval for approval in approvals}
    summaries: list[PlanSummaryOut] = []
    for plan in plans:
        pairs = [
            (
                line.currency,
                compute_line_total(effective_units(line), line.unit_cost, line.currency),
            )
            for line in plan.lines
            if line.selected
        ]
        active = active_by_plan.get(plan.id)
        summaries.append(
            PlanSummaryOut(
                id=plan.id,
                version=plan.version,
                calculationStatus=plan.calculation_status,
                reviewStatus=plan.review_status,
                totalsByCurrency=totals_by_currency(pairs),
                activeApprovalId=active.id if active else None,
                createdAt=plan.created_at,
                updatedAt=plan.updated_at,
            )
        )
    return summaries
