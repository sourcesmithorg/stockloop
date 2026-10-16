import { useState } from 'react';
import { Link } from 'react-router-dom';

import { PageHead } from '@/components/layout/page-head';
import {
  buttonClass,
  CoverageBar,
  EmptyState,
  ErrorNote,
  Field,
  LoadingRows,
  Select,
  Table,
} from '@/components/ui';
import { RiskStatePill } from '@/components/ui/status-pill';
import { api, type Product, type RiskState } from '@/lib/api';
import { coverText, coverTone, dailySalesText, leadText } from '@/lib/risk-display';
import { useApi } from '@/lib/use-api';
import { usePageTitle } from '@/lib/use-page-title';

const STATUS_OPTIONS: { value: string; label: string; states?: RiskState[] }[] = [
  { value: 'all', label: 'All statuses' },
  {
    value: 'attention',
    label: 'Needs attention',
    states: ['outOfStock', 'atRisk', 'runningLow', 'stale'],
  },
  { value: 'healthy', label: 'Healthy', states: ['healthy'] },
  { value: 'noRecentSales', label: 'No recent sales', states: ['noRecentSales'] },
  { value: 'dataNeeded', label: 'Data needed', states: ['dataNeeded'] },
];

/**
 * Inventory — GET /api/products with the embedded deterministic risk view
 * (same data as GET /api/inventory/risk). Unknown values render as words,
 * verified zeros render as zeros; scrolling stays inside the labeled table.
 */
export function InventoryPage() {
  usePageTitle('Inventory');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const products = useApi(() => api.getProducts(), []);

  const list = products.data ?? [];
  const option = STATUS_OPTIONS.find((candidate) => candidate.value === status);
  const filtered = list.filter((product) => {
    const matchesStatus = !option?.states || option.states.includes(product.risk.riskState);
    const needle = query.trim().toLowerCase();
    const matchesQuery =
      needle === '' ||
      product.name.toLowerCase().includes(needle) ||
      product.sku.toLowerCase().includes(needle);
    return matchesStatus && matchesQuery;
  });

  return (
    <>
      <PageHead
        actions={
          <Link className={buttonClass('primary')} to="/imports">
            Import inventory
          </Link>
        }
        description="Stock, demand, cover and lead time for every product in the store."
        eyebrow="Inventory"
        title="Every shelf has a story."
      />

      <div className="toolbar">
        <label className="search-field" htmlFor="inventory-search">
          <span className="sr-only">Search products</span>
          <input
            aria-describedby="inventory-search-help"
            id="inventory-search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search product name or SKU"
            type="search"
            value={query}
          />
        </label>
        <Field className="filter-field" label="Stock status">
          <Select onChange={(event) => setStatus(event.target.value)} value={status}>
            {STATUS_OPTIONS.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </Select>
        </Field>
        <span className="sr-only" id="inventory-search-help">
          Filters apply instantly to the table below.
        </span>
      </div>

      <section className="panel mt-16">
        {products.loading ? (
          <div className="panel-pad">
            <LoadingRows label="Reading the inventory snapshot…" />
          </div>
        ) : products.error ? (
          <div className="panel-pad">
            <ErrorNote error={products.error} onRetry={products.reload} />
          </div>
        ) : list.length === 0 ? (
          <div className="panel-pad">
            <EmptyState
              actions={
                <Link className="btn primary" to="/imports">
                  Import an inventory snapshot
                </Link>
              }
              icon="i-box"
              title="A clear view starts with your stock."
            >
              Import an inventory snapshot to see what’s on hand. No stock estimates are shown
              before data arrives.
            </EmptyState>
          </div>
        ) : filtered.length === 0 ? (
          <div className="panel-pad">
            <EmptyState
              actions={
                <button
                  className="btn"
                  onClick={() => {
                    setQuery('');
                    setStatus('all');
                  }}
                  type="button"
                >
                  Clear filters
                </button>
              }
              icon="i-search"
              title="No matching products."
            >
              Try a different product name or SKU, or clear the status filter to see all{' '}
              {list.length} products.
            </EmptyState>
          </div>
        ) : (
          <>
            <p className="scroll-hint mt-16">Scroll horizontally for lead times and actions.</p>
            <Table
              caption={`Inventory list: ${filtered.length} of ${list.length} products`}
              label="Inventory list"
              minWidth={860}
            >
              <thead>
                <tr>
                  <th scope="col">Product</th>
                  <th className="num" scope="col">
                    On hand
                  </th>
                  <th className="num" scope="col">
                    Daily sales
                  </th>
                  <th scope="col">Lead time</th>
                  <th scope="col">Est. cover</th>
                  <th scope="col">Status</th>
                  <th scope="col">Details</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((product) => (
                  <InventoryRow key={product.id} product={product} />
                ))}
              </tbody>
            </Table>
            <div className="panel-foot">
              <span>
                Showing {filtered.length} of {list.length} products
              </span>
              <span className="muted">Statuses come from deterministic rules, not AI.</span>
            </div>
          </>
        )}
      </section>

      <p className="data-note">
        Lead time and sales history are separate inputs. Unknown values never mean zero. All dates
        use the store timezone.
      </p>
    </>
  );
}

function InventoryRow({ product }: { product: Product }) {
  const risk = product.risk;
  return (
    <tr>
      <td className="product-cell">
        <div className="product-line">
          <div>
            <Link className="product-name" to={`/inventory/${product.id}`}>
              {product.name}
            </Link>
            <span className="sub mono">
              {product.sku} · {product.category}
            </span>
          </div>
        </div>
      </td>
      <td className="num">
        {risk.stock.kind === 'known' ? (
          `${risk.stock.value} ${risk.stock.unit}`
        ) : (
          <span className="muted">Unknown</span>
        )}
      </td>
      <td className="num">
        {risk.sales.kind === 'missing' ? (
          <span className="muted">No history</span>
        ) : (
          dailySalesText(risk)
        )}
      </td>
      <td>
        {risk.leadTime.kind === 'known' ? leadText(risk) : <span className="muted">Unknown</span>}
      </td>
      <td>
        {risk.coverDays.kind === 'finite' ? (
          <CoverageBar days={Number(risk.coverDays.value)} tone={coverTone(risk)} />
        ) : (
          <span className="muted">{coverText(risk)}</span>
        )}
      </td>
      <td>
        <RiskStatePill state={risk.riskState} />
        {risk.warnings.some((warning) => warning.code === 'stale_source') && (
          <span className="sub">Stale source data — revalidate</span>
        )}
      </td>
      <td>
        <Link className="btn small-btn" to={`/inventory/${product.id}`}>
          View details
        </Link>
      </td>
    </tr>
  );
}
