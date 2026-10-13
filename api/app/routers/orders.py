"""Purchase-order documents (immutable snapshots of an approved plan version)."""

from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import api_error, get_session, get_store
from app.domain.calculations import quantize_money
from app.models import Approval, PurchaseOrder, Store, Supplier
from app.schemas import OrderDetailOut, OrderLineSnapshot, OrderSummary

router = APIRouter(prefix="/orders", tags=["orders"])

DISCLAIMER = (
    "Order document only — nothing has been sent to the supplier; "
    "no purchase has been placed or accepted."
)


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
