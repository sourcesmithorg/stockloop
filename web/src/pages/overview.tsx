import { Link } from 'react-router-dom';

import { PageHead } from '@/components/layout/page-head';
import { buttonClass, CoverageBar, ErrorNote, LoadingRows, Table } from '@/components/ui';
import { RiskStatePill } from '@/components/ui/status-pill';
import { api, USE_MOCK, type PlanDetail, type Product } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatMoney } from '@/lib/money';
import { DEMO_DATE, STORE } from '@/lib/mock/fixtures';
import {
  ATTENTION_STATES,
  RISK_ORDER,
  coverText,
  coverTone,
  dailySalesText,
  formatDate,
  onHandText,
} from '@/lib/risk-display';
import { useApi } from '@/lib/use-api';
import { usePageTitle } from '@/lib/use-page-title';

/**
 * Overview — the landing screen inside the app. Everything below the page
 * head is derived from live reads: GET /api/products (risk-embedded) and the
 * latest plan from GET /api/plans → GET /api/plans/{id}. A section the API
 * cannot feed honestly is omitted rather than filled with fixture numbers.
 */
export function OverviewPage() {
  usePageTitle('Overview');
  const { store } = useAuth();
  // Real session store name; fixtures only in demo builds — never hardcoded.
  const storeName = store?.name ?? (USE_MOCK ? STORE.name : null);

  const products = useApi(() => api.getProducts(), []);
  const latestPlan = useApi<PlanDetail | null>(async () => {
    const summaries = await api.getPlans();
    return summaries[0] ? api.getPlan(summaries[0].id) : null;
  }, []);

  const list = products.data ?? [];
  const attention = list
    .filter((product) => ATTENTION_STATES.includes(product.risk.riskState))
    .sort((a, b) => RISK_ORDER[a.risk.riskState] - RISK_ORDER[b.risk.riskState]);
  const atRisk = list.filter((product) =>
    ['outOfStock', 'atRisk'].includes(product.risk.riskState),
  ).length;
  const runningLow = list.filter((product) => product.risk.riskState === 'runningLow').length;
  const categories = new Set(list.map((product) => product.category)).size;
  const snapshotDates = list.flatMap((product) =>
    product.risk.stock.kind === 'known' ? [product.risk.stock.asOf] : [],
  );
  const latestSnapshot = snapshotDates.sort().at(-1);

  return (
    <>
      <PageHead
        actions={
          <>
            <Link className={buttonClass()} to="/imports">
              Import data
            </Link>
            <Link className={buttonClass('primary')} to="/reorder">
              Review restock plan
            </Link>
          </>
        }
        description={
          storeName
            ? `Here’s what deserves a look at ${storeName} today.`
            : 'Here’s what deserves a look today.'
        }
        eyebrow={USE_MOCK ? DEMO_DATE.label : undefined}
        title={
          <>
            A little foresight.
            <br />A fuller shelf.
          </>
        }
      />

      {products.loading ? (
        <LoadingRows label="Reading the inventory snapshot…" />
      ) : products.error ? (
        <ErrorNote error={products.error} onRetry={products.reload} />
      ) : (
        <>
          <section aria-label="Store snapshot" className="summary-strip">
            <div className="summary-item">
              <span className="summary-label">Products tracked</span>
              <strong className="summary-value numeric">{list.length}</strong>
              <span className="small muted">
                {list.length === 0 ? 'No products yet' : `Across ${categories} categories`}
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Restock suggestions</span>
              <strong className="summary-value numeric">{attention.length}</strong>
              <span className="small muted">
                {attention.length === 0
                  ? 'Nothing needs attention right now'
                  : `${atRisk} at risk · ${runningLow} running low`}
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Restock budget</span>
              <strong className="summary-value numeric">
                {latestPlan.data?.budgets[0]?.budgetAmount
                  ? formatMoney(
                      latestPlan.data.budgets[0].budgetAmount,
                      latestPlan.data.budgets[0].currency,
                    )
                  : 'Unknown'}
              </strong>
              <span className="small muted">
                {latestPlan.data?.budgets[0]
                  ? `${latestPlan.data.budgets[0].currency} · This purchasing cycle`
                  : latestPlan.error
                    ? 'Plan unavailable'
                    : 'No budget on record'}
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Stock updated</span>
              <strong className="summary-value numeric">
                {latestSnapshot ? formatDate(latestSnapshot) : 'Unknown'}
              </strong>
              <span className="small muted">
                {latestSnapshot ? 'Latest stock snapshot' : 'No stock snapshot on record'}
              </span>
            </div>
          </section>

          <div className="dashboard-grid mt-24">
            <div className="stack-lg">
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h2>Keep these on your radar</h2>
                    <p>Prioritized by estimated stock cover and delivery time.</p>
                  </div>
                </div>
                {attention.length === 0 ? (
                  <div className="panel-pad">
                    <p className="muted">
                      Nothing needs attention — every tracked product is healthy right now.
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="scroll-hint mt-16">Scroll to see all stock details.</p>
                    <Table
                      caption={`Priority inventory: ${attention.length} product${attention.length === 1 ? '' : 's'} need attention`}
                      label="Priority inventory"
                      minWidth={640}
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
                          <th scope="col">Est. cover</th>
                          <th scope="col">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attention.map((product) => (
                          <PriorityRow key={product.id} product={product} />
                        ))}
                      </tbody>
                    </Table>
                    <div className="panel-foot">
                      <span>
                        {attention.length} item{attention.length === 1 ? '' : 's'} need attention
                      </span>
                      <Link className="text-link" to="/inventory">
                        View inventory
                      </Link>
                    </div>
                  </>
                )}
              </section>
              <p className="data-note">
                Stock cover is an estimate, not a guarantee. Sales spikes and late deliveries can
                change the picture.
              </p>
            </div>

            <aside className="rail">
              <section aria-labelledby="rail-title" className="order-rail">
                <span className="eyebrow">Your next best order</span>
                <h2 id="rail-title">
                  A small order.
                  <br />A big difference.
                </h2>
                {latestPlan.loading ? (
                  <LoadingRows label="Reading the latest restock plan…" rows={2} />
                ) : latestPlan.error ? (
                  <ErrorNote error={latestPlan.error} onRetry={latestPlan.reload} />
                ) : latestPlan.data ? (
                  <PlanRail plan={latestPlan.data} />
                ) : (
                  <p>
                    No restock plan yet. Suggestions appear once the store has stock, sales and
                    supplier terms to work from.
                  </p>
                )}
                <p className="small mt-16">Suggested, not ordered. You stay in control.</p>
              </section>
            </aside>
          </div>
        </>
      )}
    </>
  );
}

function PriorityRow({ product }: { product: Product }) {
  const risk = product.risk;
  return (
    <tr>
      <td className="product-cell">
        <div className="product-line">
          <div>
            <Link className="product-name" to={`/inventory/${product.id}`}>
              {product.name}
            </Link>
            <span className="sub mono">{product.sku}</span>
          </div>
        </div>
      </td>
      <td className="num">{onHandText(risk)}</td>
      <td className="num">{dailySalesText(risk)}</td>
      <td>
        {risk.coverDays.kind === 'finite' ? (
          <CoverageBar days={Number(risk.coverDays.value)} tone={coverTone(risk)} />
        ) : (
          <span className="muted">{coverText(risk)}</span>
        )}
      </td>
      <td>
        <RiskStatePill state={risk.riskState} />
      </td>
    </tr>
  );
}

function PlanRail({ plan }: { plan: PlanDetail }) {
  const totalLines = plan.lines.filter((entry) => entry.selected).length;
  const gapCount = plan.warnings.filter(
    (warning) => warning.code === 'delivery_estimate_unconfirmed',
  ).length;
  return (
    <div className="rail-rule">
      <span className="small muted">
        {plan.reviewStatus === 'approved' ? 'Approved plan' : 'Draft plan'} · Not ordered
      </span>
      <div className="rail-amount numeric mt-8">
        {Object.entries(plan.totalsByCurrency).map(([currency, total]) => (
          <span key={currency}>
            {formatMoney(total, currency)} <span className="small">{currency}</span>
          </span>
        ))}
      </div>
      <ul className="rail-list">
        <li>
          {totalLines} products across {plan.supplierGroups.length} supplier documents
        </li>
        {plan.budgets.map((budget) => (
          <li key={budget.currency}>
            {budget.remaining !== null
              ? `${formatMoney(budget.remaining, budget.currency)} remains in your ${budget.currency} budget`
              : `No ${budget.currency} budget on record — remaining is unknown`}
          </li>
        ))}
        {gapCount > 0 && (
          <li>
            {gapCount} delivery estimate{gapCount === 1 ? ' remains' : 's remain'} unconfirmed —
            ordering more does not close a delivery gap
          </li>
        )}
      </ul>
      <Link className="btn primary w-full" to="/reorder">
        Review restock plan
      </Link>
    </div>
  );
}
