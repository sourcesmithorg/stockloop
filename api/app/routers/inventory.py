"""Inventory risk view: the list the dashboard renders (discriminated known/unknown shapes)."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_policy, get_session, get_store, get_today
from app.models import PurchasingPolicy, Store
from app.schemas import InventoryRiskView
from app.services.risk import build_risk_views

router = APIRouter(prefix="/inventory", tags=["inventory"])


@router.get("/risk", response_model=list[InventoryRiskView])
async def inventory_risk(
    session: AsyncSession = Depends(get_session),
    store: Store = Depends(get_store),
    policy: PurchasingPolicy = Depends(get_policy),
    today: date = Depends(get_today),
) -> list[InventoryRiskView]:
    _, views = await build_risk_views(session, store, policy, today)
    return list(views.values())
