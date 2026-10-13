"""Liveness/readiness with explicit DB reachability."""

from __future__ import annotations

from time import perf_counter

from fastapi import APIRouter, Depends, Response
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.schemas import DbHealth, HealthOut

router = APIRouter(tags=["health"])

APP_VERSION = "0.1.0"


@router.get("/health", response_model=HealthOut)
async def health(response: Response, session: AsyncSession = Depends(get_session)) -> HealthOut:
    started = perf_counter()
    try:
        await session.execute(text("SELECT 1"))
    except Exception as exc:  # noqa: BLE001 — report, do not crash
        response.status_code = 503
        return HealthOut(
            status="degraded",
            db=DbHealth(reachable=False, error=type(exc).__name__),
            version=APP_VERSION,
        )
    latency_ms = int((perf_counter() - started) * 1000)
    return HealthOut(
        status="ok", db=DbHealth(reachable=True, latencyMs=latency_ms), version=APP_VERSION
    )
