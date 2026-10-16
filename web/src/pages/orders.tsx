import { useState } from 'react';
import { Link } from 'react-router-dom';

import { PageHead } from '@/components/layout/page-head';
import {
  buttonClass,
  EmptyState,
  ErrorNote,
  InlineNote,
  LoadingRows,
  Table,
} from '@/components/ui';
import { StatusPill, type PillTone } from '@/components/ui/status-pill';
import { api, type ExportAttempt, type OrderSummary } from '@/lib/api';
import { formatMoneyWithCode } from '@/lib/money';
import { formatDate } from '@/lib/risk-display';
import { useApi } from '@/lib/use-api';
import { usePageTitle } from '@/lib/use-page-title';

/** Document + approval status → text. Status is always words, never color alone. */
function orderStatus(order: OrderSummary): { label: string; tone: PillTone } {
  if (order.documentStatus === 'void') return { label: 'Void', tone: 'bad' };
  if (order.documentStatus === 'superseded' || order.approvalStatus === 'stale') {
    return { label: 'Needs refresh', tone: 'warn' };
  }
  if (order.documentStatus === 'approved' && order.approvalStatus === 'active') {
    return { label: 'Approved', tone: 'good' };
  }
  if (order.documentStatus === 'draft') return { label: 'Draft', tone: 'neutral' };
  return { label: order.documentStatus, tone: 'info' };
}

/**
 * Purchase orders — GET /api/orders. One supplier and one currency per
 * document; totals are never summed across documents or currencies.
 */
export function OrdersPage() {
  usePageTitle('Purchase orders');
  const [query, setQuery] = useState('');
  const orders = useApi(() => api.getOrders(), []);

  const list = orders.data ?? [];
  const needle = query.trim().toLowerCase();
  const filtered = list.filter(
    (order) =>
      needle === '' ||
      order.displayNumber.toLowerCase().includes(needle) ||
      order.supplierName.toLowerCase().includes(needle),
  );

  return (
    <>
      <PageHead
        actions={
          <Link className={buttonClass('primary')} to="/reorder">
            Build restock draft
          </Link>
        }
        description="Separate supplier documents. A clear approval trail."
        eyebrow="Purchase orders"
        title="From a plan to paper."
      />

      <InlineNote title="Export is not order placement.">
        These screens show purchase-order documents and export states. They never email suppliers or
        submit orders.
      </InlineNote>

      <div className="toolbar mt-16">
        <label className="search-field" htmlFor="order-search">
          <span className="sr-only">Search purchase orders</span>
          <input
            id="order-search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search order number or supplier"
            type="search"
            value={query}
          />
        </label>
      </div>

      <section className="panel mt-16">
        {orders.loading ? (
          <div className="panel-pad">
            <LoadingRows label="Reading purchase orders…" />
          </div>
        ) : orders.error ? (
          <div className="panel-pad">
            <ErrorNote error={orders.error} onRetry={orders.reload} />
          </div>
        ) : list.length === 0 ? (
          <div className="panel-pad">
            <EmptyState
              actions={
                <Link className="btn primary" to="/reorder">
                  Review restock plan
                </Link>
              }
              icon="i-file"
              title="No purchase orders yet."
            >
              Approved plans create one document per supplier. Nothing has been sent to a supplier
              from this screen.
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
              title="No matching orders."
            >
              Try a different order number or supplier name.
            </EmptyState>
          </div>
        ) : (
          <>
            <Table
              caption={`Purchase-order history: ${filtered.length} of ${list.length} orders`}
              label="Purchase-order history"
              minWidth={820}
            >
              <thead>
                <tr>
                  <th scope="col">Order</th>
                  <th scope="col">Supplier</th>
                  <th scope="col">Items</th>
                  <th className="num" scope="col">
                    Total
                  </th>
                  <th scope="col">Status</th>
                  <th scope="col">Export</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) => (
                  <OrderRow key={order.id} order={order} />
                ))}
              </tbody>
            </Table>
            <div className="panel-foot">
              <span>
                {filtered.length} of {list.length} orders shown
              </span>
              <span className="muted">All amounts shown in document currency.</span>
            </div>
          </>
        )}
      </section>

      <p className="data-note">
        Approval, export tracking, edit history, and supplier submission are separate
        responsibilities — an export success is never a supplier acceptance.
      </p>
    </>
  );
}

function OrderRow({ order }: { order: OrderSummary }) {
  const status = orderStatus(order);
  return (
    <tr>
      <td>
        <Link className="link-dark mono" to={`/orders/${order.id}`}>
          {order.displayNumber}
        </Link>
        <span className="sub">Created {formatDate(order.createdAt)}</span>
      </td>
      <td>{order.supplierName}</td>
      <td>
        <span className="numeric">
          {order.productCount} product{order.productCount === 1 ? '' : 's'} · {order.totalUnits}{' '}
          units
        </span>
      </td>
      <td className="num">
        <strong>{formatMoneyWithCode(order.itemSubtotal, order.currency)}</strong>
        <span className="sub">
          Tax {order.taxTreatment} · Shipping {order.shippingTreatment}
        </span>
      </td>
      <td>
        <StatusPill label={status.label} tone={status.tone} />
        <span className="sub">Approval: {order.approvalStatus ?? 'none on record'}</span>
      </td>
      <ExportCell order={order} />
      <td>
        {/* Same-origin, cookie-authenticated document — a plain link is the
            honest path; no fetch-then-blob indirection. */}
        <a className="btn small-btn" href={`/api/orders/${order.id}/document`}>
          Open document
        </a>
      </td>
    </tr>
  );
}

/**
 * Export action for one order. Captures attempt/result honestly: success means
 * the document was produced (never that a supplier received or accepted it);
 * a stale or superseded document is refused with the reason preserved and a
 * retry that keeps context.
 */
function ExportCell({ order }: { order: OrderSummary }) {
  const [phase, setPhase] = useState<'idle' | 'working'>('idle');
  const [result, setResult] = useState<ExportAttempt | null>(null);
  const [error, setError] = useState<unknown>(null);

  const canExport = order.documentStatus === 'approved' && order.approvalStatus === 'active';

  async function run() {
    setPhase('working');
    setError(null);
    try {
      setResult(await api.exportOrder(order.id));
    } catch (caught) {
      setResult(null);
      setError(caught);
    } finally {
      setPhase('idle');
    }
  }

  return (
    <td>
      <button
        className={buttonClass('secondary', 'sm')}
        disabled={phase === 'working'}
        onClick={() => void run()}
        type="button"
      >
        {phase === 'working' ? 'Exporting…' : 'Export'}
      </button>
      {result?.status === 'succeeded' && (
        <span className="sub">
          <a className="link-dark" href={result.documentUrl}>
            Document ready
          </a>{' '}
          — produced locally; no supplier was contacted.
        </span>
      )}
      {error != null && (
        <span className="sub">
          {error instanceof Error ? error.message : 'Export failed.'}{' '}
          <button className="link-dark" onClick={() => void run()} type="button">
            Retry
          </button>
        </span>
      )}
      {!canExport && !error && (
        <span className="sub">
          Not exportable — {order.documentStatus}, approval {order.approvalStatus ?? 'missing'}.
        </span>
      )}
    </td>
  );
}
