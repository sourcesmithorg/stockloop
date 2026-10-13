"""Supplier reads (store-scoped)."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import api_error, get_session, get_store
from app.models import Store, Supplier
from app.schemas import SupplierOut

router = APIRouter(prefix="/suppliers", tags=["suppliers"])


def supplier_out(row: Supplier) -> SupplierOut:
    return SupplierOut(
        id=row.id,
        code=row.code,
        name=row.name,
        contactEmail=row.contact_email,
        documentCurrency=row.document_currency,
        leadTimeDays=row.lead_time_days,
        deliveryDays=row.delivery_days,
        calendarConfirmed=row.delivery_days is not None,
        lastVerifiedAt=row.last_verified_at,
        version=row.version,
    )


@router.get("", response_model=list[SupplierOut])
async def list_suppliers(
    store: Store = Depends(get_store),
    session: AsyncSession = Depends(get_session),
) -> list[SupplierOut]:
    rows = (
        await session.execute(
            select(Supplier).where(Supplier.store_id == store.id).order_by(Supplier.code)
        )
    ).scalars()
    return [supplier_out(row) for row in rows]


@router.get("/{supplierId}", response_model=SupplierOut)
async def get_supplier(
    supplierId: str,
    store: Store = Depends(get_store),
    session: AsyncSession = Depends(get_session),
) -> SupplierOut:
    row = await session.get(Supplier, supplierId)
    if row is None or row.store_id != store.id:
        raise api_error("supplier_not_found", f"Supplier {supplierId} not found", 404)
    return supplier_out(row)
