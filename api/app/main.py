"""StockLoop FastAPI application factory."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from datetime import date

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import (
    ai,
    auth,
    health,
    imports,
    inventory,
    members,
    orders,
    plans,
    preferences,
    products,
    store,
    suppliers,
)


def create_app() -> FastAPI:
    @asynccontextmanager
    async def lifespan(application: FastAPI) -> AsyncGenerator[None, None]:
        from app.db import init_app_state, shutdown_app_state

        init_app_state(application)
        yield
        await shutdown_app_state(application)

    settings = get_settings()
    application = FastAPI(
        title="StockLoop API",
        version="0.1.0",
        lifespan=lifespan,
        description=(
            "Inventory purchasing copilot. Deterministic rule code is authoritative; "
            "the AI endpoints are advisory only and never gate the workflow."
        ),
    )
    application.state.settings = settings
    application.state.secret_key = settings.secret_key
    # Fixture anchor: STOCKLOOP_TODAY pins "today" so demo arithmetic is reproducible.
    application.state.today = settings.today_override or date.today()

    application.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.web_origins),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Auth + region + operational routers. /api/health stays public; every
    # operational router depends on get_store (auth-gated).
    for router in (
        health.router,
        auth.router,
        store.router,
        members.router,
        suppliers.router,
        products.router,
        inventory.router,
        plans.router,
        orders.router,
        imports.router,
        ai.router,
        preferences.router,
    ):
        application.include_router(router, prefix="/api")
    return application


app = create_app()
