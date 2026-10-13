"""CSV import endpoints: preview (validate) then commit (atomic, idempotent)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import api_error, get_session, get_store
from app.models import Store
from app.schemas import ImportCommitOut, ImportPreviewOut
from app.services.imports import REQUIRED_COLUMNS, commit_import, preview_import

router = APIRouter(prefix="/imports", tags=["imports"])


@router.post("/preview", response_model=ImportPreviewOut)
async def preview(
    file: UploadFile = File(...),
    dataset: str | None = Form(None),
    session: AsyncSession = Depends(get_session),
    store: Store = Depends(get_store),
) -> ImportPreviewOut:
    if dataset is not None and dataset not in REQUIRED_COLUMNS:
        raise api_error(
            "invalid_dataset",
            f"dataset must be one of {sorted(REQUIRED_COLUMNS)}",
            422,
            allowed=sorted(REQUIRED_COLUMNS),
        )
    content = await file.read()
    return await preview_import(
        session,
        store,
        filename=file.filename or "upload.csv",
        content=content,
        dataset_hint=dataset,
    )


@router.post("/{importId}/commit", response_model=ImportCommitOut)
async def commit(
    importId: str,
    session: AsyncSession = Depends(get_session),
    store: Store = Depends(get_store),
) -> ImportCommitOut:
    return await commit_import(session, store, importId)
