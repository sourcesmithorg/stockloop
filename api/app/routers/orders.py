"""Purchase-order documents (immutable snapshots of an approved plan version)."""

from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, Depends, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import api_error, get_session, get_store, require_role
from app.domain.calculations import quantize_money
from app.models import Approval, PurchaseOrder, Store, Supplier
from app.schemas import (
    ExportAttemptOut,
    ExportRequest,
    OrderDetailOut,
    OrderLineSnapshot,
    OrderSummary,
)
from app.services.exports import (
    DISCLAIMER,
    attempt_out,
    create_export,
    list_attempts,
    order_document,
)

router = APIRouter(prefix="/orders", tags=["orders"])


async def _order_summaries(
    session: AsyncSession, store: Store, orders: list[PurchaseOrder]
) -> list[OrderSummary]:
    suppliers = {
        row.id: row
        for row in (
            await session.execute(select(Supplier).where(Supplier.store_id == store.id))
        ).scalars()
    }
    approval_ids = {order.approval_id for order in orders}
    approvals: list[Approval] = []
    if approval_ids:
        result = await session.execute(select(Approval).where(Approval.id.in_(approval_ids)))
        approvals = list(result.scalars())
    approval_status = {approval.id: approval.status for approval in approvals}
    return [
        OrderSummary(
            id=order.id,
            displayNumber=order.display_number,
            supplierId=order.supplier_id,
            supplierName=suppliers[order.supplier_id].name
            if order.supplier_id in suppliers
            else "unknown",
            currency=order.currency,
            itemSubtotal=quantize_money(order.item_subtotal, order.currency),
            taxTreatment=order.tax_treatment,
            shippingTreatment=order.shipping_treatment,
            documentStatus=order.document_status,
            approvalId=order.approval_id,
            approvalStatus=approval_status.get(order.approval_id),
            planId=order.plan_id,
            productCount=len(order.lines),
            totalUnits=sum(
                (Decimal(str(entry.get("baseUnits", "0"))) for entry in order.lines), Decimal(0)
            ),
            createdAt=order.created_at,
        )
        for order in orders
    ]


@router.get("", response_model=list[OrderSummary])
async def list_orders(
    session: AsyncSession = Depends(get_session),
    store: Store = Depends(get_store),
) -> list[OrderSummary]:
    orders = list(
        (
            await session.execute(
                select(PurchaseOrder)
                .where(PurchaseOrder.store_id == store.id)
                .order_by(PurchaseOrder.display_number.desc())
            )
        ).scalars()
    )
    return await _order_summaries(session, store, orders)


@router.get("/{orderId}", response_model=OrderDetailOut)
async def get_order(
    orderId: str,
    session: AsyncSession = Depends(get_session),
    store: Store = Depends(get_store),
) -> OrderDetailOut:
    order = await session.get(PurchaseOrder, orderId)
    if order is None or order.store_id != store.id:
        raise api_error("order_not_found", f"Order {orderId} not found", 404)
    summaries = await _order_summaries(session, store, [order])
    summary = summaries[0]
    approval = await session.get(Approval, order.approval_id)
    return OrderDetailOut(
        **summary.model_dump(),
        planVersion=approval.plan_version if approval else None,
        lines=[
            OrderLineSnapshot(
                productId=str(entry.get("productId")),
                sku=str(entry.get("sku")),
                productName=str(entry.get("productName")),
                supplierId=str(entry.get("supplierId")),
                baseUnits=Decimal(str(entry.get("baseUnits", "0"))),
                purchasePackUnits=int(entry.get("purchasePackUnits", 0)),
                purchasePackCount=int(entry.get("purchasePackCount", 0)),
                unitCost=Decimal(str(entry.get("unitCost", "0"))),
                currency=str(entry.get("currency")),
                lineTotal=Decimal(str(entry.get("lineTotal", "0"))),
            )
            for entry in order.lines
        ],
        supplierSnapshot=order.supplier_snapshot,
        disclaimer=DISCLAIMER,
    )


@router.post("/{orderId}/export", response_model=ExportAttemptOut)
async def export_order(
    orderId: str,
    body: ExportRequest | None = None,
    session: AsyncSession = Depends(get_session),
    store: Store = Depends(get_store),
    _role: None = Depends(require_role("operator")),
) -> ExportAttemptOut:
    """Produce the document for the approved current version and record the attempt.

    Refusals (superseded document, stale approval, plan moved on) are 409s with
    a field-scoped conflict — and are themselves recorded as failed attempts.
    Success means the file was produced locally, never that a supplier was
    contacted.
    """
    attempt, _html = await create_export(
        session, store, orderId, actor_id=body.actorId if body else "owner"
    )
    order = await session.get(PurchaseOrder, orderId)
    assert order is not None  # create_export already resolved it
    return ExportAttemptOut(**attempt_out(attempt, order))


@router.get("/{orderId}/exports", response_model=list[ExportAttemptOut])
async def get_order_exports(
    orderId: str,
    session: AsyncSession = Depends(get_session),
    store: Store = Depends(get_store),
) -> list[ExportAttemptOut]:
    rows = await list_attempts(session, store, orderId)
    return [ExportAttemptOut(**row) for row in rows]


@router.get("/{orderId}/document")
async def get_order_document(
    orderId: str,
    session: AsyncSession = Depends(get_session),
    store: Store = Depends(get_store),
) -> Response:
    """Print-friendly HTML for the approved current version (same guards as export)."""
    html, digest = await order_document(session, store, orderId)
    return Response(
        content=html,
        media_type="text/html; charset=utf-8",
        headers={
            "Content-Disposition": f'inline; filename="{orderId}.html"',
            "ETag": f'"{digest}"',
        },
    )
