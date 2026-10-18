"""Advisory AI endpoint — never 500s; falls back to rule-based explanations."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_policy, get_session, get_store, get_today
from app.models import PurchasingPolicy, Store
from app.schemas import AiAskRequest, AiAskResponse, AiExplainRequest, AiExplainResponse
from app.services.ai import explain
from app.services.ask import (
    MAX_UPLOAD_BYTES,
    UPLOAD_EXTENSIONS,
    ask,
    extract_file_context,
)

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


def pydantic_errors(exc: ValidationError) -> str:
    """Short readable field errors for the 422 envelope."""
    return "; ".join(
        f"{'.'.join(str(part) for part in error['loc'])}: {error['msg']}" for error in exc.errors()
    )


def _accept_upload(filename: str | None) -> bool:
    if filename is None:
        return False
    suffix = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    return suffix in {ext.lstrip(".") for ext in UPLOAD_EXTENSIONS}


async def _parse_multipart(request: Request) -> tuple[AiAskRequest, str | None, str]:
    """Multipart variant of POST /ask: `question` + optional uploaded context
    file. Everything stays in-memory; nothing about this request is persisted.
    Content-type decides the parse — the JSON path keeps its own format."""
    content_type = request.headers.get("content-type", "").split(";", 1)[0].strip().lower()
    if content_type != "multipart/form-data":
        request_json = await request.json()
        return AiAskRequest(**request_json), None, ""

    form = await request.form()
    question = form.get("question")
    if not isinstance(question, str) or not question.strip():
        raise HTTPException(
            status_code=422, detail={"code": "validation_error", "message": "question: required"}
        )
    upload = form.get("file")
    if upload is None or isinstance(upload, str):
        return AiAskRequest(question=question), None, ""

    language: str | None = None
    form_language = form.get("language")
    if isinstance(form_language, str) and form_language.strip():
        language = form_language.strip()

    filename = getattr(upload, "filename", None)
    if not _accept_upload(filename):
        raise HTTPException(
            status_code=400,
            detail={
                "code": "unsupported_file_type",
                "message": "Only .txt .md .csv .json files are accepted.",
            },
        )
    assert filename is not None
    raw = await upload.read()
    if not raw:
        raise HTTPException(
            status_code=400,
            detail={"code": "empty_file", "message": "The uploaded file is empty."},
        )
    if raw.startswith(b"\x00") or b"\x00" in raw[:4096]:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "binary_file_rejected",
                "message": "Only .txt .md .csv .json text files are accepted.",
            },
        )
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "file_too_large",
                "message": "File too large — the limit is 200 KB.",
            },
        )
    context = extract_file_context(filename, raw)
    if not context:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "empty_file",
                "message": "The uploaded file contained no readable text.",
            },
        )
    return AiAskRequest(question=question, language=language), filename, context


@router.post("/ask", response_model=AiAskResponse)
async def ai_ask(
    request: Request,
    session: AsyncSession = Depends(get_session),
    store: Store = Depends(get_store),
    policy: PurchasingPolicy = Depends(get_policy),
    today: date = Depends(get_today),
) -> AiAskResponse:
    """Advisory Q&A scoped to the authenticated store. Read-only: proposals
    are inert drafts and provider failure is an honest error here only.
    Accepts JSON {question} or multipart with `question` + optional context
    `file` (txt/md/csv/json, 200 KB cap) — the file is prompt context only and
    nothing about it is stored."""
    content_type = request.headers.get("content-type", "").split(";", 1)[0].strip().lower()
    try:
        if content_type == "multipart/form-data":
            body, file_name, file_context = await _parse_multipart(request)
        else:
            try:
                payload = await request.json()
            except ValueError as exc:
                raise HTTPException(
                    status_code=422,
                    detail={
                        "code": "validation_error",
                        "message": "Request body is not valid JSON.",
                    },
                ) from exc
            try:
                body = AiAskRequest(**payload)
            except ValidationError as exc:
                raise HTTPException(
                    status_code=422,
                    detail={"code": "validation_error", "message": pydantic_errors(exc)},
                ) from exc
            file_name, file_context = None, ""
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - defensive only
        raise HTTPException(
            status_code=400,
            detail={"code": "invalid_request", "message": "The request body could not be read."},
        ) from exc

    try:
        return await ask(session, store, policy, today, body, file_name, file_context)
    except HTTPException:
        raise
