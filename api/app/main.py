"""StockLoop FastAPI application factory."""

from __future__ import annotations

from datetime import date

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import ai, health, imports, inventory, orders, plans, products, suppliers


def create_app() -> FastAPI:
    settings = get_settings()
    application = FastAPI(
        title="StockLoop API",
        version="0.1.0",
        description=(
            "Inventory purchasing copilot. Deterministic rule code is authoritative; "
            "the AI endpoints are advisory only and never gate the workflow."
        ),
    )
    application.state.settings = settings
    # Fixture anchor: STOCKLOOP_TODAY pins "today" so demo arithmetic is reproducible.
    application.state.today = settings.today_override or date.today()
    application.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.web_origins),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    for router in (
        health.router,
        suppliers.router,
        products.router,
        inventory.router,
        plans.router,
        orders.router,
        imports.router,
        ai.router,
    ):
        application.include_router(router, prefix="/api")
    return application


app = create_app()
