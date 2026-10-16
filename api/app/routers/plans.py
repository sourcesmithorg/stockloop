"""Plan reads, line edits (version-bumping), and approval."""

from __future__ import annotations

from datetime import UTC, date, datetime

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import api_error, get_policy, get_session, get_store, get_today, require_role
from app.models import Plan, PlanLine, PurchasingPolicy, Store
from app.schemas import (
    ApprovalOut,
    ApproveRequest,
    EditLineRequest,
    PlanDetailOut,
    PlanSummaryOut,
)
from app.services.plans import (
    approve_plan,
    edit_line,
    load_plan,
    plan_detail,
    plan_summaries,
)

router = APIRouter(prefix="/plans", tags=["plans"])


@router.get("", response_model=list[PlanSummaryOut])
async def list_plans(
    session: AsyncSession = Depends(get_session),
    store: Store = Depends(get_store),
) -> list[PlanSummaryOut]:
    return await plan_summaries(session, store)


@router.get("/{planId}", response_model=PlanDetailOut)
async def get_plan(
    planId: str,
    session: AsyncSession = Depends(get_session),
    store: Store = Depends(get_store),
    policy: PurchasingPolicy = Depends(get_policy),
    today: date = Depends(get_today),
) -> PlanDetailOut:
    plan = await load_plan(session, store, planId)
    return await plan_detail(session, store, plan, today)


async def _load_line(session: AsyncSession, plan: Plan, line_id: str) -> PlanLine:
    line = await session.get(PlanLine, line_id)
    if line is None or line.plan_id != plan.id:
        raise api_error("line_not_found", f"Plan line {line_id} not found", 404)
    return line


@router.post("/{planId}/lines/{lineId}", response_model=PlanDetailOut)
async def update_plan_line(
    planId: str,
    lineId: str,
    body: EditLineRequest,
    session: AsyncSession = Depends(get_session),
    store: Store = Depends(get_store),
    policy: PurchasingPolicy = Depends(get_policy),
    today: date = Depends(get_today),
    _role: None = Depends(require_role("operator")),
) -> PlanDetailOut:
    plan = await load_plan(session, store, planId)
    line = await _load_line(session, plan, lineId)
    await edit_line(
        session,
        store,
        plan,
        line,
        units=body.editedBaseUnits,
        expected_version=body.expectedPlanVersion,
    )
    plan.updated_at = datetime.now(UTC)
    return await plan_detail(session, store, plan, today)


@router.post("/{planId}/approve", response_model=ApprovalOut)
async def approve(
    planId: str,
    body: ApproveRequest,
    session: AsyncSession = Depends(get_session),
    store: Store = Depends(get_store),
    policy: PurchasingPolicy = Depends(get_policy),
    today: date = Depends(get_today),
    _role: None = Depends(require_role()),
) -> ApprovalOut:
    plan = await load_plan(session, store, planId)
    return await approve_plan(
        session,
        store,
        plan,
        expected_version=body.expectedPlanVersion,
        acknowledged_warnings=body.acknowledgedWarnings,
        actor_id=body.actorId,
        today=today,
    )
