import { Link, useParams } from 'react-router-dom';

import { PageHead } from '@/components/layout/page-head';
import { buttonClass, InlineNote } from '@/components/ui';
import { USE_MOCK } from '@/lib/api';
import { DEMO_DATE } from '@/lib/mock/fixtures';
import { usePageTitle } from '@/lib/use-page-title';

import { PlaceholderPage } from './placeholder';

export { LoginPage } from './login';
export { OnboardingPage } from './onboarding';
export { RegisterPage } from './register';
export { SettingsPage } from './settings';
export { WelcomePage } from './welcome';

export function OverviewPage() {
  return (
    <PlaceholderPage
      actions={
        <Link className={buttonClass('primary')} to="/reorder">
          Review restock plan
        </Link>
      }
      description="Here’s what deserves a look at Maple & Main today."
      docTitle="Overview"
      eyebrow={USE_MOCK ? DEMO_DATE.label : undefined}
      note="Scoped restock suggestions, priority table, freshness, budget and activity — fed by GET /api/inventory/risk and GET /api/plans/{id}."
      owner="Overview workstream"
      title={
        <>
          A little foresight.
          <br />A fuller shelf.
        </>
      }
    />
  );
}

export function InventoryPage() {
  return (
    <PlaceholderPage
      description="Stock, demand, cover and lead time for every product in the store."
      docTitle="Inventory"
      eyebrow="Inventory"
      note="Identity, stock, demand, cover, lead time and risk state with search/filter/pagination — fed by GET /api/products and GET /api/inventory/risk. Scrolling stays inside the labeled table region."
      owner="Inventory workstream"
      title="Every shelf has a story."
    />
  );
}

export function ProductPage() {
  const { productId = 'unknown' } = useParams();
  return (
    <PlaceholderPage
      description="Inputs, depletion and delivery timeline for this SKU."
      docTitle="Product"
      eyebrow="Inventory"
      note={`Why this product is risky: inputs, supplier terms, explanation and SKU-scale history — fed by GET /api/products/${productId}.`}
      owner="Product workstream"
      title={`Product · ${productId}`}
    />
  );
}

export function ReorderPage() {
  return (
    <PlaceholderPage
      description="Edit quantities, review supplier groups and totals, approve when it looks right."
      docTitle="Reorder studio"
      eyebrow="Reorder studio"
      note="Entry point to editable plan lines with the apricot totals/constraint rail — plans are opened at /plans/:planId and fed by GET /api/plans/{id} plus POST /api/plans/{id}/lines/{lineId}."
      owner="Reorder workstream"
      title="A thoughtful restock."
    />
  );
}

export function PlanPage() {
  const { planId = 'unknown' } = useParams();
  return (
    <PlaceholderPage
      description="Editable lines, supplier groups and the review rail."
      docTitle="Restock plan"
      eyebrow="Reorder studio"
      note={`Line quantities, pack/MOQ rounding, budget meter and approval — fed by GET /api/plans/${planId}, POST /api/plans/${planId}/lines/{lineId} and POST /api/plans/${planId}/approve. Tax and shipping stay excluded, never zero.`}
      owner="Reorder workstream"
      title={`Restock plan · ${planId}`}
    />
  );
}

export function OrdersPage() {
  return (
    <PlaceholderPage
      description="Exact approved documents, one supplier and one currency each."
      docTitle="Purchase orders"
      eyebrow="Purchase orders"
      note="List of approved purchase orders with document status, export attempts and source plan version — fed by GET /api/orders."
      owner="Orders workstream"
      title="From a plan to paper."
    />
  );
}

export function OrderDetailPage() {
  const { orderId = 'unknown' } = useParams();
  return (
    <PlaceholderPage
      description="The exact approved document — quantities, currency and version."
      docTitle="Purchase order"
      eyebrow="Purchase orders"
      note={`Supplier-document layout (distinct from the dashboard), immutable approved lines, subtotal with tax/shipping treatment, and export history — fed by GET /api/orders/${orderId}. Export success never means “order placed”.`}
      owner="Orders workstream"
      title={`Purchase order · ${orderId}`}
    />
  );
}

export function SuppliersPage() {
  return (
    <PlaceholderPage
      description="Terms, packs, MOQs and lead times that shape every suggestion."
      docTitle="Suppliers"
      eyebrow="Suppliers"
      note="Supplier directory with currency, delivery calendar and verification freshness — fed by GET /api/suppliers."
      owner="Suppliers workstream"
      title={
        <>
          Good relationships.
          <br />
          Better replenishment.
        </>
      }
    />
  );
}

export function SupplierPage() {
  const { supplierId = 'unknown' } = useParams();
  return (
    <PlaceholderPage
      description="Contact, currency, packs/MOQ, lead time and delivery calendar."
      docTitle="Supplier"
      eyebrow={`Supplier / ${supplierId}`}
      note={`Reviewed terms, products and last-verified details — fed by GET /api/suppliers/${supplierId}. Calendar versus business-day lead times stay explicit.`}
      owner="Suppliers workstream"
      title={`Supplier · ${supplierId}`}
    />
  );
}

export function ImportsPage() {
  return (
    <PlaceholderPage
      description="Bring stock and sales in from a spreadsheet."
      docTitle="Data imports"
      eyebrow="Data imports"
      note="Readiness and dataset sources with schema/format help — fed by POST /api/imports/preview. Distinguish no data from no matches; commit only when valid."
      owner="Imports workstream"
      title="Better data. Better decisions."
    />
  );
}

export function ImportMappingPage() {
  const { importId = 'unknown' } = useParams();
  return (
    <PlaceholderPage
      description={`Import ${importId} · step 1 of 3.`}
      docTitle="Map columns"
      eyebrow="Inventory import"
      note="Map spreadsheet columns to StockLoop fields; incomplete required mapping keeps Continue disabled with the field error visible."
      owner="Imports workstream"
      title="Make the columns speak the same language."
    />
  );
}

export function ImportValidationPage() {
  const { importId = 'unknown' } = useParams();
  return (
    <PlaceholderPage
      description={`Import ${importId} · step 2 of 3.`}
      docTitle="Validate import"
      eyebrow="Inventory import"
      note="Row number, column, bad value, expected format, severity and correction hint for every issue — fed by POST /api/imports/preview. Blocking issues prevent continuation; warnings are counted, never silent."
      owner="Imports workstream"
      title="A quick check before it goes in."
    />
  );
}

export function ImportResultPage() {
  const { importId = 'unknown' } = useParams();
  return (
    <PlaceholderPage
      description={`Import ${importId} · step 3 of 3.`}
      docTitle="Import complete"
      eyebrow="Inventory import"
      note={`Committed counts, skipped rows and the resulting data version — fed by POST /api/imports/${importId}/commit. Import success is not a claim about any other system.`}
      owner="Imports workstream"
      title="Your data has a fresh start."
    />
  );
}

/**
 * Not-found: a genuinely useful missing/deleted record state — explains what
 * happened, states nothing changed, and offers the real navigation paths.
 */
export function NotFoundPage() {
  usePageTitle('Not found');
  return (
    <>
      <PageHead
        actions={
          <Link className={buttonClass('primary')} to="/overview">
            Back to overview
          </Link>
        }
        description="This record may have been deleted, or the link may be out of date. Nothing was changed."
        eyebrow="Not found"
        title="We couldn’t find that record."
      />
      <div className="panel panel-pad stack">
        <h2>One of these will get you moving</h2>
        <ul className="stack">
          <li>
            <Link className="text-link" to="/overview">
              Overview — what deserves a look today
            </Link>
          </li>
          <li>
            <Link className="text-link" to="/inventory">
              Inventory — find the product instead
            </Link>
          </li>
          <li>
            <Link className="text-link" to="/orders">
              Purchase orders — find the document instead
            </Link>
          </li>
          <li>
            <Link className="text-link" to="/imports">
              Data imports — check recent imports
            </Link>
          </li>
        </ul>
        <InlineNote tone="info" title="If you followed a link from an old screen">
          Record IDs are stable, but fixtures only contain the demo records (PLAN-001,
          PO-2026-0041/0042, SUP-001/002, the seven demo SKUs). Anything else is missing or deleted
          until the real API serves it.
        </InlineNote>
      </div>
    </>
  );
}
