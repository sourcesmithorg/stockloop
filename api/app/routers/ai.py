"""Advisory AI endpoint — never 500s; falls back to rule-based explanations."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_policy, get_session, get_store, get_today
from app.models import PurchasingPolicy, Store
from app.schemas import AiExplainRequest, AiExplainResponse
from app.services.ai import explain

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/explain", response_model=AiExplainResponse)
async def ai_explain(
    body: AiExplainRequest,
    session: AsyncSession = Depends(get_session),
    store: Store = Depends(get_store),
    policy: PurchasingPolicy = Depends(get_policy),
    today: date = Depends(get_today),
) -> AiExplainResponse:
    return await explain(session, store, policy, today, body)
