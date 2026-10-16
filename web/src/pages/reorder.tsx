import { useState } from 'react';
import { Link } from 'react-router-dom';

import { PageHead } from '@/components/layout/page-head';
import { Icon } from '@/components/layout/icon';
import {
  BudgetMeter,
  Button,
  Disclosure,
  EmptyState,
  ErrorNote,
  Field,
  InlineNote,
  LoadingRows,
  QuantityInput,
  StatusPill,
  Table,
} from '@/components/ui';
import { api, ApiError, type PlanDetail, type PlanLine } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatMoney } from '@/lib/money';
import { formatDateTime } from '@/lib/risk-display';
import { useApi } from '@/lib/use-api';
import { usePageTitle } from '@/lib/use-page-title';

function traceText(trace: Record<string, unknown>, key: string): string | null {
  const value = trace[key];
  return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
}

/**
 * Reorder studio — GET /api/plans (latest) → GET /api/plans/{id}, with
 * operator edits via POST /plans/{id}/lines/{lineId} and owner approval via
 * POST /plans/{id}/approve. Deterministic rules are authoritative: quantities
 * come from the server, explanations only explain, and approval binds the
 * version it was reviewed against.
 */
export function ReorderPage() {
  usePageTitle('Reorder studio');
  const { user } = useAuth();
  const canEdit = user?.role === 'owner' || user?.role === 'operator';
  const canApprove = user?.role === 'owner';

  const planState = useApi<PlanDetail | null>(async () => {
    const summaries = await api.getPlans();
    return summaries[0] ? api.getPlan(summaries[0].id) : null;
  }, []);
  const plan = planState.data;

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({});
  const [savingLine, setSavingLine] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<unknown>(null);
  const [reviewed, setReviewed] = useState(false);

  const approved = Boolean(plan?.activeApproval);
  const hasPendingEdits = Object.entries(drafts).some(
    ([lineId, value]) =>
      plan?.lines.some(
        (line) => line.id === lineId && value !== '' && value !== line.effectiveBaseUnits,
      ) ?? false,
  );

  async function saveLine(line: PlanLine, units: string) {
    if (!plan) return;
    setSavingLine(line.id);
    setLineErrors((previous) => ({ ...previous, [line.id]: '' }));
    try {
      const updated = await api.updatePlanLine(plan.id, line.id, {
        editedBaseUnits: units,
        expectedPlanVersion: plan.version,
      });
      planState.setData(updated);
      setDrafts((previous) => {
        const next = { ...previous };
        delete next[line.id];
        return next;
      });
    } catch (caught) {
      setLineErrors((previous) => ({
        ...previous,
        [line.id]: caught instanceof Error ? caught.message : 'Could not save this quantity.',
      }));
      // A 409 means the plan moved on — reload so the version on screen is true.
      if (caught instanceof ApiError && caught.status === 409) planState.reload();
    } finally {
      setSavingLine(null);
    }
  }

  async function approve() {
    if (!plan) return;
    setApproving(true);
    setApproveError(null);
    try {
      await api.approvePlan(plan.id, {
        acknowledgedWarnings: plan.warnings.map((warning) => warning.code),
        expectedPlanVersion: plan.version,
      });
      planState.reload();
    } catch (caught) {
      setApproveError(caught);
      if (caught instanceof ApiError && caught.status === 409) planState.reload();
    } finally {
      setApproving(false);
    }
  }

  return (
    <>
      <PageHead
        description="Start with the suggestion. Make it your order."
        eyebrow="Reorder studio"
        title="A thoughtful restock."
      />

      {planState.loading ? (
        <LoadingRows label="Reading the restock plan…" />
      ) : planState.error ? (
        <ErrorNote error={planState.error} onRetry={planState.reload} />
      ) : !plan ? (
        <EmptyState
          actions={
            <Link className="btn primary" to="/inventory">
              Review inventory
            </Link>
          }
          icon="i-spark"
          title="No restock plan yet."
        >
          Suggestions appear here once the store has stock, sales history and supplier terms for the
          deterministic rules to work from.
        </EmptyState>
      ) : (
        <div className="work-grid">
          <div className="stack-lg">
            <section className="decision-sheet" data-component="recommendation-context">
              <div className="row between wrap">
                <span className="row">
                  Suggested with context
                  <StatusPill
                    label={
                      plan.explanationSource === 'ai'
                        ? 'AI-assisted explanation'
                        : 'Rule-based suggestions'
                    }
                    tone={plan.explanationSource === 'ai' ? 'accent' : 'info'}
                  />
                </span>
                <span className="pill outline">
                  {plan.reviewStatus === 'approved' ? 'Approved' : 'Draft'} · version {plan.version}
                </span>
              </div>
              <p className="small muted mt-16">
                Deterministic rules set every quantity below; explanations only explain and never
                approve. Pack sizes, minimum orders, and budget are separate checks.
              </p>
            </section>

            {plan.blockers.length > 0 && (
              <div className="inline-note bad">
                <Icon name="i-warn" />
                <div>
                  <strong>
                    {plan.blockers.length} blocker(s) must be resolved before approval.
                  </strong>
                  <ul>
                    {plan.blockers.map((blocker) => (
                      <li key={`${blocker.code}-${blocker.message}`}>{blocker.message}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            {plan.warnings.length > 0 && (
              <div className="inline-note warn">
                <Icon name="i-warn" />
                <div>
                  <strong>Review before approving.</strong>
                  <ul>
                    {plan.warnings.map((warning) => (
                      <li key={`${warning.code}-${warning.message}`}>{warning.message}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            {plan.activeApproval && (
              <InlineNote tone="good" title="Plan approved.">
                Approved {formatDateTime(plan.activeApproval.approvedAt)} against policy{' '}
                {plan.policyVersion}. Quantity edits or updated inputs require revalidation and
                reapproval.{' '}
                {plan.activeApproval.orders.map((order) => (
                  <Link key={order.id} to={`/orders/${order.id}`}>
                    {order.displayNumber}{' '}
                  </Link>
                ))}
              </InlineNote>
            )}

            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>Review the {plan.lines.length} suggestions</h2>
                  <p>Enter base units; purchase pack size is shown underneath.</p>
                </div>
                {!approved && <StatusPill label="Needs your review" tone="warn" />}
              </div>
              <p className="scroll-hint mt-16">Scroll for quantities, prices, and explanations.</p>
              <Table
                caption={`Restock plan lines: ${plan.lines.length} products, version ${plan.version}`}
                label="Reorder draft line items"
                minWidth={1020}
              >
                <thead>
                  <tr>
                    <th scope="col">Product / supplier</th>
                    <th scope="col">Inputs</th>
                    <th className="num" scope="col">
                      Proposed units
                    </th>
                    <th className="num" scope="col">
                      Unit cost
                    </th>
                    <th className="num" scope="col">
                      Line total
                    </th>
                    <th scope="col">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.lines.map((line) => {
                    const draft = drafts[line.id] ?? line.effectiveBaseUnits;
                    const dirty = draft !== line.effectiveBaseUnits && draft !== '';
                    return (
                      <tr key={line.id}>
                        <td className="product-cell">
                          <div className="product-line">
                            <div>
                              <Link className="product-name" to={`/inventory/${line.productId}`}>
                                {line.productName}
                              </Link>
                              <span className="sub mono">{line.sku}</span>
                              <span className="sub">{line.supplierName}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          {traceText(line.ruleTrace, 'onHandUnits') ?? 'Unknown'} units on hand
                          <span className="sub">
                            {traceText(line.ruleTrace, 'demandPerDay') ?? 'Unknown'}/day ·{' '}
                            {traceText(line.ruleTrace, 'leadTimeDays') ?? 'unknown'}-day lead
                            (estimated)
                          </span>
                        </td>
                        <td className="num">
                          <Field
                            className="qty-field"
                            error={lineErrors[line.id] || undefined}
                            label={`Proposed units for ${line.productName}`}
                          >
                            <QuantityInput
                              disabled={!canEdit || approved || savingLine === line.id}
                              label={`Proposed units for ${line.productName}`}
                              min={0}
                              onValueChange={(value) =>
                                setDrafts((previous) => ({
                                  ...previous,
                                  [line.id]: value === null ? '' : String(value),
                                }))
                              }
                              step={line.purchasePackUnits}
                              value={Number(draft)}
                            />
                          </Field>
                          <span className="sub">
                            {line.purchasePackCount} packs × {line.purchasePackUnits} base units
                          </span>
                          {line.editedBaseUnits !== null && (
                            <StatusPill className="mt-4" label="Owner edit" tone="neutral" />
                          )}
                          {canEdit && !approved && dirty && (
                            <Button
                              loading={savingLine === line.id}
                              loadingLabel="Saving…"
                              onClick={() => {
                                void saveLine(line, draft);
                              }}
                              size="sm"
                              type="button"
                            >
                              Save quantity for {line.productName}
                            </Button>
                          )}
                        </td>
                        <td className="num">
                          {formatMoney(line.unitCost, line.currency)}
                          <span className="sub">{line.currency}</span>
                        </td>
                        <td className="num">
                          <strong>{formatMoney(line.lineTotal, line.currency)}</strong>
                        </td>
                        <td>
                          <StatusPill
                            label={
                              line.editedBaseUnits !== null
                                ? 'Owner edit'
                                : line.ruleTrace.moqApplied
                                  ? 'MOQ applied'
                                  : 'Pack-rounded'
                            }
                            tone={line.ruleTrace.moqApplied ? 'warn' : 'neutral'}
                          />
                          <Disclosure table summary="Why this quantity?">
                            {line.explanation}
                          </Disclosure>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
              <div className="panel-foot">
                <span id="qty-note" className="small muted">
                  Saving an edit sends the quantity to the server, which recomputes pack counts and
                  totals — this screen never multiplies money itself.
                </span>
              </div>
            </section>
          </div>

          <aside>
            <section className="panel" data-component="order-review-summary">
              <div className="panel-head">
                <div>
                  <h2>Your order, at a glance</h2>
                  <p>
                    {plan.reviewStatus === 'approved'
                      ? 'Approved · immutable'
                      : 'Draft · not approved'}
                  </p>
                </div>
              </div>
              <div className="panel-pad">
                <dl className="facts numeric">
                  <div>
                    <dt>Products</dt>
                    <dd>{plan.lines.length}</dd>
                  </div>
                  <div>
                    <dt>Supplier documents</dt>
                    <dd>{plan.supplierGroups.length}</dd>
                  </div>
                  {plan.supplierGroups.map((group) => (
                    <div key={group.supplierId}>
                      <dt>{group.supplierName}</dt>
                      <dd>
                        {formatMoney(group.subtotal, group.currency)} {group.currency}
                      </dd>
                    </div>
                  ))}
                </dl>
                {Object.entries(plan.totalsByCurrency).map(([currency, total]) => (
                  <div className="total-line" key={currency}>
                    <span>Proposed total ({currency})</span>
                    <strong className="numeric">{formatMoney(total, currency)}</strong>
                  </div>
                ))}
                {plan.budgets.map((budget) => (
                  <BudgetMeter
                    budgetAmount={budget.budgetAmount}
                    className="mt-16"
                    currency={budget.currency}
                    excludedNote="Tax and shipping are excluded — excluded, not zero."
                    key={budget.currency}
                    selectedTotal={budget.selectedTotal}
                  />
                ))}
                <hr className="mini-divider" />
                <ul className="checklist">
                  <li>Pack sizes and MOQ shown per line.</li>
                  <li>
                    {plan.warnings.filter(
                      (warning) => warning.code === 'delivery_estimate_unconfirmed',
                    ).length > 0
                      ? 'Delivery estimates need review — ordering more does not close a delivery gap.'
                      : 'No delivery warnings on this version.'}
                  </li>
                </ul>
                <hr className="mini-divider" />
                {!approved ? (
                  <>
                    <label className="checkbox-line" htmlFor="owner-review">
                      <input
                        checked={reviewed}
                        id="owner-review"
                        onChange={(event) => setReviewed(event.target.checked)}
                        type="checkbox"
                      />
                      <span>
                        I have reviewed quantities and delivery risks.
                        <small>
                          Approval is recorded with this plan version; later edits require
                          reapproval.
                        </small>
                      </span>
                    </label>
                    <Button
                      aria-describedby="approve-reason"
                      className="mt-16 w-full"
                      disabled={
                        !canApprove ||
                        !reviewed ||
                        hasPendingEdits ||
                        plan.blockers.length > 0 ||
                        plan.calculationStatus !== 'valid'
                      }
                      loading={approving}
                      loadingLabel="Approving…"
                      onClick={() => {
                        void approve();
                      }}
                      type="button"
                      variant="primary"
                    >
                      Approve plan
                    </Button>
                    <p className="small muted mt-8" id="approve-reason">
                      {!canApprove
                        ? 'Viewers cannot approve plans — an owner must review and approve.'
                        : !reviewed
                          ? 'Confirm you reviewed quantities and delivery risks to enable approval.'
                          : hasPendingEdits
                            ? 'Save your quantity changes before approving.'
                            : plan.blockers.length > 0
                              ? 'Approval is blocked until the blockers above are resolved.'
                              : 'Approval binds this exact plan version.'}
                    </p>
                  </>
                ) : (
                  <p className="small muted">
                    This version is approved and immutable. Create a new plan version to change
                    quantities.
                  </p>
                )}
                {approveError !== null && (
                  <div className="mt-16">
                    <ErrorNote
                      error={approveError}
                      onRetry={() => {
                        void approve();
                      }}
                      title="Approval failed."
                    />
                  </div>
                )}
              </div>
            </section>
          </aside>
        </div>
      )}
    </>
  );
}
