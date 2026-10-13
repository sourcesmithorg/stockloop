"""Product reads with the derived risk view embedded (frontend contract)."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import api_error, get_policy, get_session, get_store, get_today
from app.domain.calculations import quantize_money, quantize_quantity
from app.models import Product, ProductSupplierTerms, PurchasingPolicy, SalesRecord, Store, Supplier
from app.schemas import (
    InventoryRiskView,
    ProductDetailOut,
    ProductOut,
    SalesPointOut,
    SupplierBrief,
    TermsOut,
)
from app.services.inputs import ProductInputs
from app.services.risk import build_risk_views

router = APIRouter(prefix="/products", tags=["products"])


def _terms_out(item: ProductInputs) -> TermsOut | None:
    terms, supplier = item.terms, item.supplier
    if terms is None or supplier is None:
        return None
    return TermsOut(
        id=terms.id,
        supplierId=terms.supplier_id,
        unitCost=quantize_money(terms.unit_cost, supplier.document_currency),
        currency=supplier.document_currency,
        purchasePackUnits=terms.purchase_pack_units,
        minimumOrderUnits=quantize_quantity(
            terms.minimum_order_units, item.product.quantity_precision
        ),
        leadTimeValue=terms.lead_time_value,
        leadTimeUnit=terms.lead_time_unit,
        version=terms.version,
    )


def _product_out(item: ProductInputs, view: InventoryRiskView) -> ProductOut:
    product = item.product
    supplier = item.supplier
    return ProductOut(
        id=product.id,
        sku=product.sku,
        name=product.name,
        category=product.category,
        baseUnit=product.base_unit,
        quantityPrecision=product.quantity_precision,
        status=product.status,
        supplier=(
            SupplierBrief(id=supplier.id, code=supplier.code, name=supplier.name)
            if supplier is not None
            else None
        ),
        terms=_terms_out(item),
        risk=view,
    )


@router.get("", response_model=list[ProductOut])
async def list_products(
    session: AsyncSession = Depends(get_session),
    store: Store = Depends(get_store),
    policy: PurchasingPolicy = Depends(get_policy),
    today: date = Depends(get_today),
) -> list[ProductOut]:
    catalog, views = await build_risk_views(session, store, policy, today)
    return [
        _product_out(item, views[item.product.id])
        for item in catalog.items
        if item.product.id in views
    ]


@router.get("/{productId}", response_model=ProductDetailOut)
async def get_product(
    productId: str,
    session: AsyncSession = Depends(get_session),
    store: Store = Depends(get_store),
    policy: PurchasingPolicy = Depends(get_policy),
    today: date = Depends(get_today),
) -> ProductDetailOut:
    product = await session.get(Product, productId)
    if product is None or product.store_id != store.id:
        raise api_error("product_not_found", f"Product {productId} not found", 404)
    catalog, views = await build_risk_views(session, store, policy, today)
    item = next((entry for entry in catalog.items if entry.product.id == productId), None)
    if item is None:  # archived product: minimal detail, explicit unknown risk
        terms = (
            (
                await session.execute(
                    select(ProductSupplierTerms).where(
                        ProductSupplierTerms.store_id == store.id,
                        ProductSupplierTerms.product_id == productId,
                    )
                )
            )
            .scalars()
            .first()
        )
        supplier = (
            (
                await session.execute(
                    select(Supplier).where(
                        Supplier.store_id == store.id,
                        Supplier.id == (terms.supplier_id if terms else ""),
                    )
                )
            )
            .scalars()
            .first()
        )
        item = ProductInputs(
            product=product,
            terms=terms,
            supplier=supplier,
            snapshot=None,
            observed_days=0,
            sales_total=Decimal(0),
            last_sales_date=None,
        )
    view = views.get(productId)
    if view is None:
        from app.services.risk import build_risk_view

        view = build_risk_view(item, catalog, policy, today)
    series_rows = (
        await session.execute(
            select(SalesRecord.business_date, SalesRecord.quantity_sold)
            .where(
                SalesRecord.store_id == store.id,
                SalesRecord.product_id == productId,
                SalesRecord.business_date >= catalog.window_start,
                SalesRecord.business_date <= catalog.window_end,
            )
            .order_by(SalesRecord.business_date)
        )
    ).all()
    precision = item.product.quantity_precision
    return ProductDetailOut(
        **_product_out(item, view).model_dump(),
        salesSeries=[
            SalesPointOut(date=row[0], quantity=quantize_quantity(row[1], precision))
            for row in series_rows
        ],
    )
