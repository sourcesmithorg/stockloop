import { Link, useParams } from 'react-router-dom';

import { PageHead } from '@/components/layout/page-head';
import { buttonClass, InlineNote } from '@/components/ui';
import { usePageTitle } from '@/lib/use-page-title';

import { PlaceholderPage } from './placeholder';

export { ImportsPage } from './imports';
export { InventoryPage } from './inventory';
export { LandingPage } from './landing';
export { LoginPage } from './login';
export { OnboardingPage } from './onboarding';
export { OrdersPage } from './orders';
export { OverviewPage } from './overview';
export { RegisterPage } from './register';
export { ReorderPage } from './reorder';
export { SettingsPage } from './settings';
export { SuppliersPage } from './suppliers';
export { WelcomePage } from './welcome';

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
        <InlineNote title="If you followed a link from an old screen">
          Record IDs are stable, but fixtures only contain the demo records (PLAN-001,
          PO-2026-0041/0042, SUP-001/002, the seven demo SKUs). Anything else is missing or deleted
          until the real API serves it.
        </InlineNote>
      </div>
    </>
  );
}
