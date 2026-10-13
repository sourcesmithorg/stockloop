"""CSV import preview and atomic commit.

The file is untrusted data: rows are validated, issues are recorded per row/field,
blocking issues prevent commit (T-07/T-08), and a committed import is idempotent
(T-09: replayed commits cannot duplicate sales).
"""

from __future__ import annotations

import csv
import hashlib
import io
from datetime import UTC, date, datetime
from decimal import Decimal, InvalidOperation
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import api_error
from app.domain.calculations import CalculationError, require_finite_nonnegative
from app.models import ImportIssue, ImportJob, Product, SalesRecord, StockSnapshot, Store, Supplier
from app.schemas import ImportCommitOut, ImportCounts, ImportIssueOut, ImportPreviewOut

MAX_BYTES = 2 * 1024 * 1024
MAX_ROWS = 10_000
SCHEMA_VERSION = "v1"

REQUIRED_COLUMNS: dict[str, tuple[str, ...]] = {
    "sales": ("sku", "sale_date", "quantity_sold"),
    "inventory": ("sku", "stock_on_hand", "snapshot_date"),
}


def _issue(
    row_number: int | None,
    field: str | None,
    code: str,
    severity: str,
    value: str | None = None,
    expected: str | None = None,
    hint: str | None = None,
) -> ImportIssue:
    return ImportIssue(
        id=str(uuid4()),
        import_id="",  # bound by caller
        row_number=row_number,
        field=field,
        issue_code=code,
        severity=severity,
        value_preview=(value[:120] if value is not None else None),
        expected_format=expected,
        correction_hint=hint,
    )


def _detect_dataset(headers: set[str]) -> str:
    for dataset, required in REQUIRED_COLUMNS.items():
        if set(required) <= headers:
            return dataset
    return "unknown"


async def preview_import(
    session: AsyncSession,
    store: Store,
    *,
    filename: str,
    content: bytes,
    dataset_hint: str | None,
) -> ImportPreviewOut:
    now = datetime.now(UTC)
    job = ImportJob(
        id=str(uuid4()),
        store_id=store.id,
        dataset=dataset_hint or "unknown",
        filename=filename[:260],
        byte_size=len(content),
        source_digest=hashlib.sha256(content).hexdigest(),
        schema_version=SCHEMA_VERSION,
        status="previewed",
        commit_policy="atomic",
        created_at=now,
        mapping={},
        parsed_rows=[],
    )
    issues: list[ImportIssue] = []

    if len(content) > MAX_BYTES:
        raise api_error(
            "file_too_large", f"Import exceeds the {MAX_BYTES // (1024 * 1024)} MiB limit", 413
        )

    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        job.dataset = dataset_hint or "unknown"
        job.status = "blocked"
        issues.append(
            _issue(
                None,
                None,
                "encoding_invalid",
                "blocking",
                expected="UTF-8 CSV",
                hint="Re-export the file as UTF-8 and upload again",
            )
        )
        return await _persist(session, store, job, issues)

    reader = csv.reader(io.StringIO(text))
    try:
        rows = list(reader)
    except csv.Error as exc:
        job.status = "blocked"
        issues.append(
            _issue(
                None,
                None,
                "csv_parse_invalid",
                "blocking",
                value=str(exc)[:80],
                expected="well-formed CSV",
                hint="Fix the file structure and re-upload",
            )
        )
        return await _persist(session, store, job, issues)

    if not rows:
        job.status = "blocked"
        issues.append(_issue(None, None, "empty_file", "blocking", expected="header row plus data"))
        return await _persist(session, store, job, issues)

    headers = [cell.strip() for cell in rows[0]]
    header_set = set(headers)
    dataset = dataset_hint or _detect_dataset(header_set)
    job.dataset = dataset

    if dataset not in REQUIRED_COLUMNS:
        job.status = "blocked"
        issues.append(
            _issue(
                None,
                None,
                "unknown_dataset",
                "blocking",
                value=",".join(headers[:8]),
                expected="columns matching sales (sku,sale_date,quantity_sold) or "
                "inventory (sku,stock_on_hand,snapshot_date)",
                hint="Map the file to a dataset or fix the header row",
            )
        )
        return await _persist(session, store, job, issues)

    required = REQUIRED_COLUMNS[dataset]
    missing = [column for column in required if column not in header_set]
    if missing:
        job.status = "blocked"
        for column in missing:
            issues.append(
                _issue(
                    None,
                    column,
                    "missing_required_column",
                    "blocking",
                    expected=f"column '{column}'",
                    hint=f"Add or map a '{column}' column, then revalidate (T-07)",
                )
            )
        return await _persist(session, store, job, issues)

    job.mapping = {column: column for column in required}
    data_rows = rows[1:]
    if len(data_rows) > MAX_ROWS:
        job.status = "blocked"
        issues.append(
            _issue(
                None,
                None,
                "too_many_rows",
                "blocking",
                value=str(len(data_rows)),
                expected=f"at most {MAX_ROWS} rows",
                hint="Split the file and upload in batches",
            )
        )
        return await _persist(session, store, job, issues)

    products = {
        row.sku: row
        for row in (
            await session.execute(select(Product).where(Product.store_id == store.id))
        ).scalars()
    }
    suppliers = {
        row.code: row
        for row in (
            await session.execute(select(Supplier).where(Supplier.store_id == store.id))
        ).scalars()
    }

    parsed: list[dict[str, object]] = []
    seen_keys: set[tuple[str, str]] = set()
    total = valid = warning = rejected = 0

    if dataset == "sales":
        existing = await _existing_sales_dates(session, store, products, data_rows, headers)
    else:
        existing = set()

    for offset, raw in enumerate(data_rows):
        row_number = offset + 1
        if not any(cell.strip() for cell in raw):
            continue  # blank line: not a row
        total += 1
        record = dict(zip(headers, raw, strict=False))
        row_issues: list[ImportIssue] = []

        product = _lookup_product(products, record.get("sku"))
        if product is None:
            row_issues.append(
                _issue(
                    row_number,
                    "sku",
                    "unknown_sku",
                    "blocking",
                    value=record.get("sku"),
                    expected="a SKU that exists in this store",
                    hint="Create the product or correct the SKU",
                )
            )

        parsed_row: dict[str, object] = {"row": row_number}
        if product is not None:
            parsed_row["productId"] = product.id
            parsed_row["sku"] = product.sku

        if dataset == "sales":
            parsed_row.update(
                _validate_sales_row(row_number, record, product, existing, seen_keys, row_issues)
            )
        else:
            parsed_row.update(
                _validate_inventory_row(
                    row_number, record, product, suppliers, seen_keys, row_issues
                )
            )

        if any(issue.severity == "blocking" for issue in row_issues):
            rejected += 1
            issues.extend(row_issues)
            continue
        if row_issues:
            warning += 1
        else:
            valid += 1
        issues.extend(row_issues)
        parsed.append(parsed_row)

    job.total_rows = total
    job.valid_rows = valid
    job.warning_rows = warning
    job.rejected_rows = rejected
    job.parsed_rows = parsed
    job.status = "validated" if rejected == 0 else "blocked"
    return await _persist(session, store, job, issues)


def _lookup_product(products: dict[str, Product], sku_cell: str | None) -> Product | None:
    if sku_cell is None:
        return None
    return products.get(sku_cell.strip())


def _parse_decimal_cell(
    row_number: int, field: str, record: dict[str, str], issues: list[ImportIssue]
) -> Decimal | None:
    raw = (record.get(field) or "").strip()
    try:
        value = Decimal(raw)
    except InvalidOperation:
        value = None
    if value is None:
        issues.append(
            _issue(
                row_number,
                field,
                "invalid_quantity",
                "blocking",
                value=raw,
                expected="a number",
                hint="Correct the quantity and re-upload",
            )
        )
        return None
    try:
        require_finite_nonnegative(value, field)
    except CalculationError as exc:
        issues.append(
            _issue(
                row_number,
                field,
                "invalid_quantity",
                "blocking",
                value=raw,
                expected="a finite, non-negative number",
                hint=str(exc),
            )
        )
        return None
    return value


def _parse_date_cell(
    row_number: int, field: str, record: dict[str, str], issues: list[ImportIssue]
) -> date | None:
    raw = (record.get(field) or "").strip()
    try:
        return date.fromisoformat(raw)
    except ValueError:
        issues.append(
            _issue(
                row_number,
                field,
                "invalid_date",
                "blocking",
                value=raw,
                expected="ISO date YYYY-MM-DD",
                hint="Correct the date and re-upload",
            )
        )
        return None


def _validate_sales_row(
    row_number: int,
    record: dict[str, str],
    product: Product | None,
    existing: set[tuple[str, date]],
    seen: set[tuple[str, str]],
    issues: list[ImportIssue],
) -> dict[str, object]:
    extra: dict[str, object] = {}
    quantity = _parse_decimal_cell(row_number, "quantity_sold", record, issues)
    business_date = _parse_date_cell(row_number, "sale_date", record, issues)
    if quantity is None or business_date is None:
        return extra
    if product is None:
        return extra
    key = (product.sku, business_date.isoformat())
    if key in seen:
        issues.append(
            _issue(
                row_number,
                "sale_date",
                "duplicate_key",
                "warning",
                value=f"{product.sku} {business_date.isoformat()}",
                expected="one row per SKU per date",
                hint="Later duplicates are ignored at commit; the first row wins",
            )
        )
        extra["skip"] = True
    elif (product.id, business_date) in existing:
        issues.append(
            _issue(
                row_number,
                "sale_date",
                "duplicate_existing",
                "warning",
                value=f"{product.sku} {business_date.isoformat()}",
                expected="one row per SKU per date",
                hint="Row already recorded; it will be skipped at commit",
            )
        )
        extra["skip"] = True
    seen.add(key)
    extra.update(
        {
            "businessDate": business_date.isoformat(),
            "quantity": str(quantity),
            "skip": extra.get("skip", False),
        }
    )
    return extra


def _validate_inventory_row(
    row_number: int,
    record: dict[str, str],
    product: Product | None,
    suppliers: dict[str, Supplier],
    seen: set[tuple[str, str]],
    issues: list[ImportIssue],
) -> dict[str, object]:
    extra: dict[str, object] = {}
    quantity = _parse_decimal_cell(row_number, "stock_on_hand", record, issues)
    snapshot_date = _parse_date_cell(row_number, "snapshot_date", record, issues)
    supplier_cell = (record.get("supplier_id") or "").strip()
    if supplier_cell and supplier_cell not in suppliers:
        issues.append(
            _issue(
                row_number,
                "supplier_id",
                "unknown_supplier",
                "blocking",
                value=supplier_cell,
                expected="a supplier code that exists in this store",
                hint="Add the supplier or correct the code",
            )
        )
    if quantity is None or snapshot_date is None or product is None:
        return extra
    key = (product.sku, "stock")
    if key in seen:
        issues.append(
            _issue(
                row_number,
                "sku",
                "duplicate_key",
                "warning",
                value=product.sku,
                expected="one stock row per SKU",
                hint="Later duplicates are ignored at commit; the first row wins",
            )
        )
        extra["skip"] = True
    seen.add(key)
    extra.update(
        {
            "asOf": snapshot_date.isoformat(),
            "quantity": str(quantity),
            "skip": extra.get("skip", False),
        }
    )
    return extra


async def _existing_sales_dates(
    session: AsyncSession,
    store: Store,
    products: dict[str, Product],
    data_rows: list[list[str]],
    headers: list[str],
) -> set[tuple[str, date]]:
    """Sales dates already recorded for the SKUs/dates present in the file."""
    if "sku" not in headers or "sale_date" not in headers:
        return set()
    sku_idx = headers.index("sku")
    date_idx = headers.index("sale_date")
    wanted_products: set[str] = set()
    wanted_dates: set[date] = set()
    for raw in data_rows:
        if len(raw) <= max(sku_idx, date_idx):
            continue
        product = products.get(raw[sku_idx].strip())
        if product is None:
            continue
        wanted_products.add(product.id)
        try:
            wanted_dates.add(date.fromisoformat(raw[date_idx].strip()))
        except ValueError:
            continue
    if not wanted_products or not wanted_dates:
        return set()
    rows = (
        await session.execute(
            select(SalesRecord.product_id, SalesRecord.business_date).where(
                SalesRecord.store_id == store.id,
                SalesRecord.product_id.in_(wanted_products),
                SalesRecord.business_date.in_(wanted_dates),
            )
        )
    ).all()
    return {(row[0], row[1]) for row in rows}


async def _persist(
    session: AsyncSession, store: Store, job: ImportJob, issues: list[ImportIssue]
) -> ImportPreviewOut:
    session.add(job)
    for issue in issues:
        issue.import_id = job.id
        session.add(issue)
    await session.flush()
    return ImportPreviewOut(
        importId=job.id,
        dataset=job.dataset,
        filename=job.filename,
        byteSize=job.byte_size,
        sourceDigest=job.source_digest,
        schemaVersion=job.schema_version,
        commitPolicy=job.commit_policy,
        status=job.status,
        mapping={str(k): str(v) for k, v in job.mapping.items()},
        counts=ImportCounts(
            totalRows=job.total_rows,
            validRows=job.valid_rows,
            warningRows=job.warning_rows,
            rejectedRows=job.rejected_rows,
        ),
        issues=[
            ImportIssueOut(
                rowNumber=issue.row_number,
                field=issue.field,
                issueCode=issue.issue_code,
                severity=issue.severity,
                valuePreview=issue.value_preview,
                expectedFormat=issue.expected_format,
                correctionHint=issue.correction_hint,
            )
            for issue in issues
        ],
        createdAt=job.created_at,
    )


async def commit_import(session: AsyncSession, store: Store, import_id: str) -> ImportCommitOut:
    """Atomic commit: blocking issues reject the commit; replayed commits are no-ops."""
    job = await session.get(ImportJob, import_id)
    if job is None or job.store_id != store.id:
        raise api_error("import_not_found", f"Import {import_id} not found", 404)

    if job.status == "committed":
        return _commit_out(job)
    if job.status == "blocked":
        issue_rows = list(
            (
                await session.execute(select(ImportIssue).where(ImportIssue.import_id == job.id))
            ).scalars()
        )
        raise api_error(
            "import_blocked",
            "Import has blocking issues — fix and re-upload (atomic policy changes nothing)",
            409,
            counts=ImportCounts(
                totalRows=job.total_rows,
                validRows=job.valid_rows,
                warningRows=job.warning_rows,
                rejectedRows=job.rejected_rows,
            ).model_dump(),
            issues=[
                {
                    "rowNumber": issue.row_number,
                    "field": issue.field,
                    "issueCode": issue.issue_code,
                    "severity": issue.severity,
                    "valuePreview": issue.value_preview,
                    "expectedFormat": issue.expected_format,
                    "correctionHint": issue.correction_hint,
                }
                for issue in issue_rows
            ],
        )

    # Replay guard: the same file bytes already committed under another job.
    duplicate = (
        (
            await session.execute(
                select(ImportJob).where(
                    ImportJob.store_id == store.id,
                    ImportJob.dataset == job.dataset,
                    ImportJob.source_digest == job.source_digest,
                    ImportJob.status == "committed",
                    ImportJob.id != job.id,
                )
            )
        )
        .scalars()
        .first()
    )
    if duplicate is not None:
        raise api_error(
            "import_already_committed",
            "This file was already committed",
            409,
            existingImportId=duplicate.id,
        )

    applied = 0
    skipped = 0
    if job.dataset == "sales":
        applied, skipped = await _commit_sales(session, store, job)
    elif job.dataset == "inventory":
        applied, skipped = await _commit_inventory(session, store, job)
    else:  # unknown dataset never reaches here: blocked at preview
        raise api_error("import_blocked", f"Dataset {job.dataset} cannot be committed", 409)

    store.version += 1
    job.status = "committed"
    job.committed_at = datetime.now(UTC)
    job.resulting_version = store.version
    job.applied_rows = applied
    job.skipped_rows = skipped
    await session.flush()
    return _commit_out(job)


async def _commit_sales(session: AsyncSession, store: Store, job: ImportJob) -> tuple[int, int]:
    parsed = [row for row in job.parsed_rows if isinstance(row, dict)]
    product_ids = {str(row["productId"]) for row in parsed if "productId" in row}
    dates = {
        date.fromisoformat(str(row["businessDate"])) for row in parsed if "businessDate" in row
    }
    existing: set[tuple[str, date]] = set()
    if product_ids and dates:
        rows = (
            await session.execute(
                select(SalesRecord.product_id, SalesRecord.business_date).where(
                    SalesRecord.store_id == store.id,
                    SalesRecord.product_id.in_(product_ids),
                    SalesRecord.business_date.in_(dates),
                )
            )
        ).all()
        existing = {(row[0], row[1]) for row in rows}

    applied = 0
    skipped = 0
    for row in parsed:
        if row.get("skip") or "productId" not in row or "businessDate" not in row:
            skipped += 1
            continue
        product_id = str(row["productId"])
        business_date = date.fromisoformat(str(row["businessDate"]))
        if (product_id, business_date) in existing:
            skipped += 1
            continue
        session.add(
            SalesRecord(
                id=str(uuid4()),
                store_id=store.id,
                product_id=product_id,
                business_date=business_date,
                quantity_sold=Decimal(str(row["quantity"])),
                source_key=job.filename,
                import_id=job.id,
                source_version=SCHEMA_VERSION,
            )
        )
        existing.add((product_id, business_date))
        applied += 1
    return applied, skipped


async def _commit_inventory(session: AsyncSession, store: Store, job: ImportJob) -> tuple[int, int]:
    parsed = [row for row in job.parsed_rows if isinstance(row, dict)]
    product_ids = {str(row["productId"]) for row in parsed if "productId" in row}
    products = (
        {
            row.id: row
            for row in (
                await session.execute(
                    select(Product).where(Product.store_id == store.id, Product.id.in_(product_ids))
                )
            ).scalars()
        }
        if product_ids
        else {}
    )
    applied = 0
    skipped = 0
    for row in parsed:
        if row.get("skip") or "productId" not in row or "asOf" not in row:
            skipped += 1
            continue
        product = products.get(str(row["productId"]))
        if product is None:
            skipped += 1
            continue
        session.add(
            StockSnapshot(
                id=str(uuid4()),
                store_id=store.id,
                product_id=product.id,
                quantity=Decimal(str(row["quantity"])),
                base_unit=product.base_unit,
                as_of=date.fromisoformat(str(row["asOf"])),
                import_id=job.id,
                source_version=SCHEMA_VERSION,
            )
        )
        applied += 1
    return applied, skipped


def _commit_out(job: ImportJob) -> ImportCommitOut:
    return ImportCommitOut(
        importId=job.id,
        dataset=job.dataset,
        status=job.status,
        appliedRows=job.applied_rows,
        skippedRows=job.skipped_rows,
        resultingStoreVersion=job.resulting_version or 0,
        committedAt=job.committed_at or datetime.now(UTC),
    )
