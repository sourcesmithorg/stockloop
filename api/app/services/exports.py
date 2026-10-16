"""Purchase-order export: guard, render, and honestly record every attempt.

An export exists only for an approved, current document. Three guards run
before anything is produced:

1. the purchase order must be in `document_status = "approved"`;
2. its approval must still be `active` (not stale/revoked);
3. the bound plan must still be at the approved version.

Each refusal is recorded as a failed attempt (with the same field-scoped
error the API returns) — nothing is deleted, nothing is reinterpreted. The
rendered document is deterministic from the immutable snapshot, so a retried
export produces the identical document (same digest), never a second one.
"Export ready" means the file was produced locally; StockLoop never emails
suppliers and never records sent/accepted state.
"""

from __future__ import annotations

import hashlib
from datetime import UTC, datetime
from html import escape
from typing import Any
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import api_error
from app.domain.calculations import quantize_money
from app.models import Approval, ExportAttempt, Plan, PurchaseOrder, Store, Supplier

DISCLAIMER = (
    "Order document only — nothing has been sent to the supplier; "
    "no purchase has been placed or accepted."
)

DOCUMENT_URL_PREFIX = "/api/orders"


def document_url(order_id: str) -> str:
    return f"{DOCUMENT_URL_PREFIX}/{order_id}/document"


def _format_dt(value: datetime) -> str:
    aware = value.astimezone(UTC) if value.tzinfo else value.replace(tzinfo=UTC)
    return aware.strftime("%b %d, %Y %H:%M UTC")


def export_blocker(
    order: PurchaseOrder, approval: Approval | None, plan: Plan | None
) -> HTTPException | None:
    """Field-scoped 409 when this order must not be exported right now."""
    if order.document_status != "approved":
        return api_error(
            "order_not_exportable",
            f"Order {order.display_number} is '{order.document_status}', not approved — "
            "export only the current approved document",
            409,
            field="documentStatus",
            documentStatus=order.document_status,
        )
    if approval is None or approval.status != "active":
        return api_error(
            "approval_not_active",
            f"Approval {order.approval_id} is "
            f"{approval.status if approval else 'missing'} — re-approve the current plan "
            "before exporting",
            409,
            field="approvalStatus",
            approvalStatus=approval.status if approval else "missing",
        )
    if plan is None:
        return api_error(
            "stale_export",
            f"Plan {order.plan_id} no longer exists — the approved version cannot be "
            "verified, so no export is produced",
            409,
            field="planVersion",
            approvedPlanVersion=approval.plan_version,
            currentPlanVersion=None,
        )
    if plan.version != approval.plan_version:
        return api_error(
            "stale_export",
            f"Plan {plan.id} moved to version {plan.version} after approval "
            f"version {approval.plan_version} — re-approve before exporting",
            409,
            field="planVersion",
            approvedPlanVersion=approval.plan_version,
            currentPlanVersion=plan.version,
        )
    return None


def _blocker_detail(exc: HTTPException) -> dict[str, Any]:
    return exc.detail if isinstance(exc.detail, dict) else {}


async def supplier_name(session: AsyncSession, store: Store, order: PurchaseOrder) -> str:
    supplier = await session.get(Supplier, order.supplier_id)
    if supplier is not None:
        return supplier.name
    snap_name = order.supplier_snapshot.get("name") if order.supplier_snapshot else None
    return str(snap_name) if snap_name else "unknown"


def render_order_document(
    *,
    order: PurchaseOrder,
    approval: Approval,
    store: Store,
    supplier: str,
) -> str:
    """Print-friendly standalone HTML for exactly the approved snapshot.

    Deterministic: every field comes from immutable rows, so identical retries
    hash identically. Amounts are the stored decimal texts — no arithmetic,
    no conversion. Missing tax/shipping treatment renders as "Not set", never 0.
    """
    snapshot = order.supplier_snapshot if isinstance(order.supplier_snapshot, dict) else {}
    contact = snapshot.get("contactEmail")
    supplier_code = snapshot.get("code")
    subtotal = str(quantize_money(order.item_subtotal, order.currency))
    tax = str(order.tax_treatment).strip() or "Not set"
    shipping = str(order.shipping_treatment).strip() or "Not set"
    approved_at = _format_dt(approval.approved_at)
    created_at = _format_dt(order.created_at)

    rows = "".join(
        "<tr>"
        f"<td><span class='product-name'>{escape(str(entry.get('productName', '')))}</span>"
        f"<span class='sub mono'>{escape(str(entry.get('sku', '')))}</span></td>"
        f"<td>{escape(str(entry.get('purchasePackCount', '')))} cases × "
        f"{escape(str(entry.get('purchasePackUnits', '')))}</td>"
        f"<td class='num'>{escape(str(entry.get('baseUnits', '')))}</td>"
        f"<td class='num'>{escape(str(entry.get('unitCost', '')))} {escape(order.currency)}</td>"
        f"<td class='num'>{escape(str(entry.get('lineTotal', '')))} {escape(order.currency)}</td>"
        "</tr>"
        for entry in (order.lines if isinstance(order.lines, list) else [])
    )

    supplier_address = [f"<strong>{escape(supplier)}</strong>"]
    if supplier_code:
        supplier_address.append(f"Code {escape(str(supplier_code))}")
    if contact:
        supplier_address.append(escape(str(contact)))
    supplier_block = "<br/>".join(supplier_address)

    return f"""<!DOCTYPE html>
<html dir="ltr" lang="en">
<head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1, viewport-fit=cover" name="viewport"/>
<meta content="StockLoop purchase-order document. Produced from the approved plan
    version; nothing has been sent to a supplier." name="description"/>
<title>Purchase order {escape(order.display_number)} &middot; StockLoop</title>
<style>
:root {{
  --color-bg:oklch(97.5% .006 70); --color-surface:oklch(99.5% .003 70);
  --color-ink:oklch(25% .009 60); --color-muted:oklch(49% .011 60);
  --color-border:oklch(88% .012 70); --color-primary:oklch(51% .153 37);
  --color-success:oklch(41% .07 156); --color-success-bg:oklch(94.5% .025 150);
  --font-ui:'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  --font-mono:ui-monospace,SFMono-Regular,Consolas,monospace;
  --text-sm:.8125rem; --text-body:.9375rem;
}}
* {{ box-sizing:border-box }}
body {{ margin:0; background:var(--color-bg); color:var(--color-ink);
  font-family:var(--font-ui); font-size:var(--text-body); line-height:1.5 }}
h1,h2,h3,p {{ margin:0 }}
h1 {{ font-size:2rem; font-weight:600; letter-spacing:-.045em; line-height:1.2 }}
h2 {{ font-size:1.25rem; font-weight:600; letter-spacing:-.025em }}
h3 {{ font-size:1rem; font-weight:600; letter-spacing:-.015em }}
p {{ max-width:70ch }}
address {{ font-style:normal; font-size:var(--text-sm); line-height:1.8 }}
.muted {{ color:var(--color-muted) }}
.small {{ font-size:var(--text-sm) }}
.mono {{ font-family:var(--font-mono); font-size:var(--text-sm) }}
.mt-8 {{ margin-block-start:8px }} .mt-16 {{ margin-block-start:16px }}
.eyebrow {{ font-size:.6875rem; font-weight:700; letter-spacing:.13em;
  text-transform:uppercase; color:var(--color-muted) }}
.brand {{ display:inline-flex; align-items:center; gap:9px; font-weight:700;
  letter-spacing:-.03em; font-size:1.125rem }}
.pill {{ display:inline-flex; gap:5px; align-items:center; padding:5px 10px;
  border-radius:999px; font-size:var(--text-sm); font-weight:600 }}
.pill.good {{ background:var(--color-success-bg); color:var(--color-success) }}
.document-wrap {{ max-width:980px; margin-inline:auto; padding:32px 16px }}
.document {{ padding:32px 24px; background:var(--color-surface);
  border:1px solid var(--color-border); border-radius:16px }}
.document-title {{ font-size:1.75rem; font-weight:600; letter-spacing:-.04em }}
.document-top {{ display:flex; justify-content:space-between; gap:20px; flex-wrap:wrap }}
.document-parties {{ display:grid; gap:24px; margin-block:32px }}
.document-parties h3 {{ font-size:.6875rem; text-transform:uppercase;
  letter-spacing:.1em; color:var(--color-muted); margin-block-end:8px }}
.document-meta {{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr));
  gap:16px; margin:0; padding-block:16px; border-block:1px solid var(--color-border) }}
.document-meta dt {{ font-size:.6875rem; color:var(--color-muted); margin-block-end:4px }}
.document-meta dd {{ margin:0; font-size:var(--text-sm); word-break:break-all }}
.data-table {{ width:100%; border-collapse:collapse; font-size:var(--text-sm) }}
.data-table th {{ font-weight:500; color:var(--color-muted); background:var(--color-bg);
  text-align:start; padding:12px 16px }}
.data-table td {{ padding:16px; border-block-end:1px solid var(--color-border);
  vertical-align:middle }}
.data-table tbody tr:last-child td {{ border-block-end:0 }}
.data-table .num {{ text-align:end; white-space:nowrap }}
.data-table .sub {{ font-size:.6875rem; color:var(--color-muted); display:block }}
.product-name {{ display:block; font-weight:600 }}
.doc-table {{ min-width:560px }}
.table-scroll {{ overflow-x:auto }}
.document-totals {{ max-width:320px; margin-inline-start:auto; margin-block:24px }}
.facts {{ display:grid; gap:0; margin:0 }}
.facts>div {{ display:flex; justify-content:space-between; gap:16px;
  padding-block:10px; border-block-end:1px solid var(--color-border) }}
.facts dt {{ color:var(--color-muted) }}
.facts dd {{ margin:0; font-weight:500; text-align:end }}
.facts .total {{ font-size:1.125rem; border-block-start:1px solid var(--color-ink);
  font-weight:600 }}
.mini-divider {{ border:0; border-block-start:1px solid var(--color-border); margin-block:24px }}
.footer-note {{ margin-block-start:16px; color:var(--color-muted); font-size:var(--text-sm) }}
@media (min-width:768px) {{
  .document {{ padding:44px }}
  .document-parties {{ grid-template-columns:1fr 1fr }}
  .document-meta {{ grid-template-columns:repeat(4,minmax(0,1fr)) }}
}}
@media print {{
  body {{ background:#fff }}
  .document-wrap {{ max-width:none; padding:0 }}
  .document {{ padding:0; border:0; border-radius:0 }}
  .document-title {{ font-size:22pt }}
  .doc-table {{ min-width:0 }}
  .document-top,.document-meta,.document-parties,.document-totals,tr {{ break-inside:avoid }}
}}
</style>
</head>
<body>
<main class="document-wrap">
<article aria-labelledby="po-heading" class="document">
 <div class="document-top">
  <div>
   <p class="brand">stockloop</p>
   <p class="small muted mt-8">{escape(store.name)}</p>
  </div>
  <div>
   <p class="eyebrow">Purchase order</p>
   <h1 class="document-title mt-8" id="po-heading">{escape(order.display_number)}</h1>
   <p class="pill good mt-8">Approved document &middot; version {approval.plan_version}</p>
  </div>
 </div>
 <div class="document-parties">
  <section>
   <h3>Order from</h3>
   <address><strong>{escape(store.name)}</strong></address>
  </section>
  <section>
   <h3>Order to</h3>
   <address>{supplier_block}</address>
  </section>
 </div>
 <dl class="document-meta">
  <div><dt>Order date</dt><dd>{created_at}</dd></div>
  <div><dt>Currency</dt><dd>{escape(order.currency)}</dd></div>
  <div><dt>Approved version</dt><dd>Version {approval.plan_version} of plan
    {escape(order.plan_id)}</dd></div>
  <div><dt>Approval</dt><dd>{escape(approval.id)} &middot; approved {approved_at}</dd></div>
 </dl>
 <div class="table-scroll">
  <table class="data-table doc-table">
   <caption class="eyebrow">Items &middot; one supplier, one currency
     ({escape(order.currency)})</caption>
   <thead>
    <tr>
     <th scope="col">Product</th>
     <th scope="col">Purchase packs</th>
     <th class="num" scope="col">Base units</th>
     <th class="num" scope="col">Unit cost</th>
     <th class="num" scope="col">Line total</th>
    </tr>
   </thead>
   <tbody>{rows}
   </tbody>
  </table>
 </div>
 <div class="document-totals">
  <dl class="facts">
   <div><dt>Items subtotal</dt><dd>{subtotal} {escape(order.currency)}</dd></div>
   <div><dt>Tax treatment</dt><dd>{escape(tax)}</dd></div>
   <div><dt>Shipping treatment</dt><dd>{escape(shipping)}</dd></div>
   <div><dt><span class="total">Items total &middot; {escape(order.currency)}</span></dt>
    <dd><span class="total">{subtotal} {escape(order.currency)}</span></dd></div>
  </dl>
 </div>
 <hr class="mini-divider"/>
 <p class="small muted mt-16">{DISCLAIMER} This file reflects approved version
 {approval.plan_version} of plan {escape(order.plan_id)} (approval {escape(approval.id)}),
 produced on request — export is not order placement.</p>
<p class="footer-note">StockLoop &middot; approved snapshot, no arithmetic added at
 export time.</p>
</article>
</main>
</body>
</html>
"""


def attempt_out(attempt: ExportAttempt, order: PurchaseOrder) -> dict[str, Any]:
    return {
        "id": attempt.id,
        "orderId": order.id,
        "displayNumber": order.display_number,
        "status": attempt.status,
        "failureCode": attempt.failure_code,
        "failureMessage": attempt.failure_message,
        "documentDigest": attempt.document_digest,
        "documentUrl": document_url(order.id),
        "approvalId": attempt.approval_id,
        "planId": attempt.plan_id,
        "planVersion": attempt.plan_version,
        "currency": order.currency,
        "attemptedAt": attempt.attempted_at,
        "disclaimer": DISCLAIMER,
    }


async def _load_exportable(
    session: AsyncSession, store: Store, order_id: str
) -> tuple[PurchaseOrder, Approval, Plan, str]:
    order = await session.get(PurchaseOrder, order_id)
    if order is None or order.store_id != store.id:
        raise api_error("order_not_found", f"Order {order_id} not found", 404)
    approval = await session.get(Approval, order.approval_id)
    plan = await session.get(Plan, order.plan_id)
    blocker = export_blocker(order, approval, plan)
    if blocker is not None:
        raise blocker
    assert approval is not None and plan is not None  # narrowed by export_blocker
    return order, approval, plan, await supplier_name(session, store, order)


async def create_export(
    session: AsyncSession, store: Store, order_id: str, *, actor_id: str
) -> tuple[ExportAttempt, str]:
    """Run the guards, produce the document, record the attempt.

    A refusal is recorded as a failed attempt (committed before the 409 is
    raised, so the audit trail survives the error response). A success records
    the document digest; retries of an unchanged order share that digest and
    therefore the same document.
    """
    order = await session.get(PurchaseOrder, order_id)
    if order is None or order.store_id != store.id:
        raise api_error("order_not_found", f"Order {order_id} not found", 404)
    approval = await session.get(Approval, order.approval_id)
    plan = await session.get(Plan, order.plan_id)
    blocker = export_blocker(order, approval, plan)
    if blocker is not None:
        detail = _blocker_detail(blocker)
        session.add(
            ExportAttempt(
                id=str(uuid4()),
                store_id=store.id,
                order_id=order.id,
                approval_id=order.approval_id,
                plan_id=order.plan_id,
                # Unknown version marker: only reachable when the approval row
                # itself is gone (real versions start at 1).
                plan_version=approval.plan_version if approval else 0,
                status="failed",
                failure_code=str(detail.get("code", "export_refused")),
                failure_message=str(detail.get("message", "")),
                document_digest=None,
                actor_id=actor_id,
            )
        )
        await session.commit()  # persist the failed attempt, then surface the 409
        raise blocker
    assert approval is not None and plan is not None  # narrowed by export_blocker
    name = await supplier_name(session, store, order)
    html = render_order_document(order=order, approval=approval, store=store, supplier=name)
    attempt = ExportAttempt(
        id=str(uuid4()),
        store_id=store.id,
        order_id=order.id,
        approval_id=approval.id,
        plan_id=order.plan_id,
        plan_version=approval.plan_version,
        status="succeeded",
        document_digest=hashlib.sha256(html.encode("utf-8")).hexdigest(),
        actor_id=actor_id,
    )
    session.add(attempt)
    await session.flush()
    return attempt, html


async def order_document(session: AsyncSession, store: Store, order_id: str) -> tuple[str, str]:
    """Guarded document fetch: (html, digest). Same guards as create_export."""
    order, approval, _plan, name = await _load_exportable(session, store, order_id)
    html = render_order_document(order=order, approval=approval, store=store, supplier=name)
    return html, hashlib.sha256(html.encode("utf-8")).hexdigest()


async def list_attempts(session: AsyncSession, store: Store, order_id: str) -> list[dict[str, Any]]:
    order = await session.get(PurchaseOrder, order_id)
    if order is None or order.store_id != store.id:
        raise api_error("order_not_found", f"Order {order_id} not found", 404)
    attempts = (
        (
            await session.execute(
                select(ExportAttempt)
                .where(ExportAttempt.order_id == order.id)
                .order_by(ExportAttempt.attempted_at.desc(), ExportAttempt.id.desc())
            )
        )
        .scalars()
        .all()
    )
    return [attempt_out(attempt, order) for attempt in attempts]
