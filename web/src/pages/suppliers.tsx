import { useState } from 'react';
import { Link } from 'react-router-dom';

import { PageHead } from '@/components/layout/page-head';
import { EmptyState, ErrorNote, LoadingRows, Table } from '@/components/ui';
import { StatusPill } from '@/components/ui/status-pill';
import { api, type Supplier } from '@/lib/api';
import { formatDate } from '@/lib/risk-display';
import { useApi } from '@/lib/use-api';
import { usePageTitle } from '@/lib/use-page-title';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Readiness is derived from what is actually on record — words, not color. */
function readiness(supplier: Supplier): { label: string; tone: 'good' | 'warn'; gaps: string[] } {
  const gaps: string[] = [];
  if (!supplier.contactEmail) gaps.push('No contact email');
  if (!supplier.calendarConfirmed) gaps.push('No delivery calendar');
  if (!supplier.lastVerifiedAt) gaps.push('Never verified');
  return gaps.length === 0
    ? { label: 'Complete', tone: 'good', gaps }
    : { label: 'Setup needed', tone: 'warn', gaps };
}

/**
 * Suppliers — GET /api/suppliers plus GET /api/products for real per-supplier
 * product counts. Each supplier keeps its own document currency; totals are
 * never combined across currencies.
 */
export function SuppliersPage() {
  usePageTitle('Suppliers');
  const [query, setQuery] = useState('');
  const data = useApi(async () => {
    const [suppliers, products] = await Promise.all([api.getSuppliers(), api.getProducts()]);
    return { suppliers, products };
  }, []);

  const suppliers = data.data?.suppliers ?? [];
  const productCounts = new Map<string, number>();
  for (const product of data.data?.products ?? []) {
    if (product.supplier) {
      productCounts.set(product.supplier.id, (productCounts.get(product.supplier.id) ?? 0) + 1);
    }
  }
  const needle = query.trim().toLowerCase();
  const filtered = suppliers.filter(
    (supplier) =>
      needle === '' ||
      supplier.name.toLowerCase().includes(needle) ||
      (supplier.contactEmail ?? '').toLowerCase().includes(needle) ||
      supplier.code.toLowerCase().includes(needle),
  );

  return (
    <>
      <PageHead
        description="Keep costs, case sizes, and delivery expectations in one place."
        eyebrow="Suppliers"
        title={
          <>
            Good relationships.
            <br />
            Better replenishment.
          </>
        }
      />

      <div className="toolbar">
        <label className="search-field" htmlFor="supplier-search">
          <span className="sr-only">Search suppliers</span>
          <input
            id="supplier-search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search suppliers or contacts"
            type="search"
            value={query}
          />
        </label>
        <Link className="btn" to="/imports">
          Import suppliers
        </Link>
      </div>

      <section className="panel mt-16">
        {data.loading ? (
          <div className="panel-pad">
            <LoadingRows label="Reading the supplier directory…" />
          </div>
        ) : data.error ? (
          <div className="panel-pad">
            <ErrorNote error={data.error} onRetry={data.reload} />
          </div>
        ) : suppliers.length === 0 ? (
          <div className="panel-pad">
            <EmptyState
              actions={
                <Link className="btn primary" to="/imports">
                  Import a supplier directory
                </Link>
              }
              icon="i-truck"
              title="No suppliers yet."
            >
              Add or import supplier records so restock suggestions have costs, packs and lead times
              to work from.
            </EmptyState>
          </div>
        ) : filtered.length === 0 ? (
          <div className="panel-pad">
            <EmptyState
              actions={
                <button className="btn" onClick={() => setQuery('')} type="button">
                  Clear search
                </button>
              }
              icon="i-search"
              title="No matching suppliers."
            >
              Try a different supplier name, code or contact email.
            </EmptyState>
          </div>
        ) : (
          <>
            <Table
              caption={`Supplier directory: ${filtered.length} of ${suppliers.length} suppliers`}
              label="Supplier directory"
              minWidth={880}
            >
              <thead>
                <tr>
                  <th scope="col">Supplier</th>
                  <th scope="col">Contact</th>
                  <th scope="col">Lead time</th>
                  <th className="num" scope="col">
                    Products
                  </th>
                  <th scope="col">Currency</th>
                  <th scope="col">Readiness</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((supplier) => (
                  <SupplierRow
                    key={supplier.id}
                    count={productCounts.get(supplier.id) ?? 0}
                    supplier={supplier}
                  />
                ))}
              </tbody>
            </Table>
            <div className="panel-foot">
              <span>
                {filtered.length} of {suppliers.length} suppliers shown
              </span>
              <span className="muted">Lead times should be reviewed per product.</span>
            </div>
          </>
        )}
      </section>

      <p className="data-note">
        Different document currencies are never silently combined. Calendar-day lead times are
        estimates, not confirmed delivery slots.
      </p>
    </>
  );
}

function SupplierRow({ supplier, count }: { supplier: Supplier; count: number }) {
  const state = readiness(supplier);
  const initials = supplier.name
    .split(' ')
    .map((word) => word[0])
    .slice(0, 2)
    .join('');
  return (
    <tr>
      <td>
        <div className="product-line">
          <span className="supplier-mark">{initials}</span>
          <div>
            <Link className="product-name" to={`/suppliers/${supplier.id}`}>
              {supplier.name}
            </Link>
            <span className="sub mono">{supplier.code}</span>
          </div>
        </div>
      </td>
      <td>
        {supplier.contactEmail ?? <span className="muted">Not on file</span>}
        {supplier.lastVerifiedAt && (
          <span className="sub">Verified {formatDate(supplier.lastVerifiedAt)}</span>
        )}
      </td>
      <td>
        {supplier.leadTimeDays} days
        <span className="sub">
          {supplier.calendarConfirmed
            ? `Delivery days: ${supplier.deliveryDays?.map((day) => WEEKDAYS[day]).join(', ') ?? 'on record'}`
            : 'No delivery calendar on record — estimates are calendar bounds'}
        </span>
      </td>
      <td className="num">{count}</td>
      <td>
        <span className="mono">{supplier.documentCurrency}</span>
      </td>
      <td>
        <StatusPill label={state.label} tone={state.tone} />
        {state.gaps.length > 0 && <span className="sub">{state.gaps.join(' · ')}</span>}
      </td>
      <td>
        <Link className="btn small-btn" to={`/suppliers/${supplier.id}`}>
          View supplier
        </Link>
      </td>
    </tr>
  );
}
