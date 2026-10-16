import { useState } from 'react';
import { Link } from 'react-router-dom';

import { PageHead } from '@/components/layout/page-head';
import { Icon } from '@/components/layout/icon';
import {
  Button,
  Disclosure,
  EmptyState,
  ErrorNote,
  Field,
  InlineNote,
  Input,
  LoadingRows,
  Select,
  Table,
  buttonClass,
} from '@/components/ui';
import { StatusPill } from '@/components/ui/status-pill';
import {
  api,
  type ImportDataset,
  type ImportIssue,
  type ImportPreview,
  type ImportResult,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/risk-display';
import { useApi } from '@/lib/use-api';
import { usePageTitle } from '@/lib/use-page-title';

const REQUIRED_COLUMNS: Record<ImportDataset, string[]> = {
  inventory: ['sku', 'stock_on_hand', 'snapshot_date'],
  sales: ['sku', 'sale_date', 'quantity_sold'],
};

const DATASET_LABELS: Record<ImportDataset, string> = {
  inventory: 'Inventory snapshot',
  sales: 'Sales history',
};

/**
 * Display-layer guarantee: internal identifiers (e.g. "(T-07)") never reach a
 * user, no matter what the backend puts in a hint — the backend no longer
 * emits them, and this guard is what keeps that true for stored legacy rows,
 * other consumers, and any future hint. Do NOT delete as redundant.
 * Keeps the actionable meaning intact.
 */
function userHint(issue: ImportIssue): string {
  const raw = issue.correctionHint ?? issue.expectedFormat ?? 'See expected format.';
  return raw.replace(/\s*\(T-\d+\)\s*$/, '').trimEnd();
}

/**
 * Data imports — POST /api/imports/preview (multipart) then POST
 * /api/imports/{id}/commit. Blocking issues keep commit disabled with the
 * reason on screen; success reports committed counts, nothing more.
 */
export function ImportsPage() {
  usePageTitle('Data imports');
  const { user } = useAuth();
  const canImport = user?.role === 'owner' || user?.role === 'operator';

  const [dataset, setDataset] = useState<ImportDataset>('inventory');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [previewError, setPreviewError] = useState<unknown>(null);
  const [previewing, setPreviewing] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [commitError, setCommitError] = useState<unknown>(null);
  const [committing, setCommitting] = useState(false);

  const readiness = useApi(async () => {
    const [products, suppliers, risk] = await Promise.all([
      api.getProducts(),
      api.getSuppliers(),
      api.getInventoryRisk(),
    ]);
    return { products, suppliers, risk };
  }, []);

  async function handlePreview() {
    if (!file) return;
    setPreviewing(true);
    setPreviewError(null);
    setCommitError(null);
    setResult(null);
    try {
      setPreview(await api.previewImport({ dataset, file }));
    } catch (caught) {
      setPreviewError(caught);
    } finally {
      setPreviewing(false);
    }
  }

  async function handleCommit() {
    if (!preview) return;
    setCommitting(true);
    setCommitError(null);
    try {
      setResult(await api.commitImport(preview.importId));
      setPreview(null);
      setFile(null);
    } catch (caught) {
      setCommitError(caught);
    } finally {
      setCommitting(false);
    }
  }

  const blocking = preview?.issues.filter((issue) => issue.severity === 'blocking') ?? [];
  const latestSnapshot = (readiness.data?.risk ?? [])
    .flatMap((view) => (view.stock.kind === 'known' ? [view.stock.asOf] : []))
    .sort()
    .at(-1);
  const salesThrough = (readiness.data?.risk ?? [])
    .flatMap((view) => (view.sourceVersions.salesThrough ? [view.sourceVersions.salesThrough] : []))
    .sort()
    .at(-1);

  return (
    <>
      <PageHead
        description="A guided path from spreadsheet to a shelf you understand."
        eyebrow="Data imports"
        title="Better data. Better decisions."
      />

      <div className="work-grid">
        <div className="stack-lg">
          <section className="panel panel-pad">
            <h2>Bring your shelf into focus.</h2>
            <p className="small muted mt-8">
              Start with a CSV from your point-of-sale or inventory system.
            </p>
            <div className="field-grid two mt-24">
              <Field
                help="Inventory: stock on hand per SKU. Sales: one sale row per day."
                label="Dataset"
              >
                <Select
                  onChange={(event) => setDataset(event.target.value as ImportDataset)}
                  value={dataset}
                >
                  <option value="inventory">Inventory snapshot</option>
                  <option value="sales">Sales history</option>
                </Select>
              </Field>
              <Field
                help={`Required columns for ${DATASET_LABELS[dataset]}: ${REQUIRED_COLUMNS[dataset].join(', ')}.`}
                label="CSV file"
              >
                <Input
                  accept=".csv,text/csv"
                  onChange={(event) => {
                    setFile(event.target.files?.[0] ?? null);
                    setPreview(null);
                    setPreviewError(null);
                    setResult(null);
                  }}
                  type="file"
                />
              </Field>
            </div>
            <div className="row between wrap mt-24">
              <span className="small muted">
                {file ? `Selected: ${file.name} · ${file.size} bytes` : 'No file selected.'}
              </span>
              <Button
                aria-describedby="validate-reason"
                disabled={!file || !canImport}
                loading={previewing}
                loadingLabel="Validating…"
                onClick={() => {
                  void handlePreview();
                }}
                type="button"
                variant="primary"
              >
                Validate file
              </Button>
            </div>
            <p className="small muted mt-8" id="validate-reason">
              {!canImport
                ? 'Viewers cannot import data — an operator or owner must run imports.'
                : !file
                  ? 'Choose a CSV file to validate.'
                  : 'Validation is a preview: nothing is imported until you commit.'}
            </p>
            {previewError !== null && (
              <div className="mt-16">
                <ErrorNote
                  error={previewError}
                  onRetry={() => {
                    void handlePreview();
                  }}
                  title="The file could not be validated."
                />
              </div>
            )}
          </section>

          {preview && (
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>{blocking.length > 0 ? 'What needs attention' : 'Ready to import'}</h2>
                  <p>Row numbers refer to the CSV, including the header.</p>
                </div>
                <StatusPill
                  label={blocking.length > 0 ? 'Blocked' : 'Validated'}
                  tone={blocking.length > 0 ? 'bad' : 'good'}
                />
              </div>
              <div className="panel-pad">
                <div className="kpi-inline">
                  <div>
                    <span className="muted">Rows checked</span>
                    <strong className="numeric">{preview.counts.totalRows}</strong>
                  </div>
                  <div>
                    <span className="muted">Valid rows</span>
                    <strong className="numeric">{preview.counts.validRows}</strong>
                  </div>
                  <div>
                    <span className="muted">Blocking rows</span>
                    <strong className="numeric">{preview.counts.rejectedRows}</strong>
                  </div>
                  <div>
                    <span className="muted">Warning rows</span>
                    <strong className="numeric">{preview.counts.warningRows}</strong>
                  </div>
                </div>
                {blocking.length > 0 ? (
                  <div className="mt-16">
                    <InlineNote
                      tone="bad"
                      title={`${blocking.length} issue${blocking.length === 1 ? '' : 's'} need correction before import.`}
                    >
                      No data has been changed. Fix the source file, then upload and validate again.
                    </InlineNote>
                  </div>
                ) : (
                  <div className="mt-16">
                    <InlineNote tone="good" title="All rows passed validation.">
                      Nothing is committed until you press Import. The commit is atomic — either
                      every valid row lands, or none do.
                    </InlineNote>
                  </div>
                )}
              </div>
              {preview.issues.length > 0 && (
                <Table
                  caption="Import validation errors and warnings"
                  label="Import validation errors and warnings"
                  minWidth={780}
                >
                  <thead>
                    <tr>
                      <th className="num" scope="col">
                        Row
                      </th>
                      <th scope="col">Field</th>
                      <th scope="col">Source value</th>
                      <th scope="col">Severity</th>
                      <th scope="col">How to fix</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.issues.map((issue, index) => (
                      <tr key={`${issue.rowNumber}-${issue.field}-${index}`}>
                        <td className="num numeric">{issue.rowNumber ?? '—'}</td>
                        <td className="mono">{issue.field ?? '(file level)'}</td>
                        <td>
                          {issue.valuePreview !== null ? (
                            <code>{issue.valuePreview}</code>
                          ) : (
                            <span className="muted">Unknown</span>
                          )}
                        </td>
                        <td>
                          <StatusPill
                            label={issue.severity === 'blocking' ? 'Blocking' : 'Warning'}
                            tone={issue.severity === 'blocking' ? 'bad' : 'warn'}
                          />
                        </td>
                        <td>{userHint(issue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
              <div className="panel-foot">
                <span className="small muted" id="commit-reason">
                  {blocking.length > 0
                    ? 'Import is blocked in this state.'
                    : `Committing imports ${preview.counts.validRows} rows for ${DATASET_LABELS[dataset as ImportDataset] ?? preview.dataset}.`}
                </span>
                <Button
                  aria-describedby="commit-reason"
                  disabled={blocking.length > 0 || !canImport || committing}
                  loading={committing}
                  loadingLabel="Importing…"
                  onClick={() => {
                    void handleCommit();
                  }}
                  type="button"
                  variant="primary"
                >
                  Import {preview.counts.validRows} rows
                </Button>
              </div>
            </section>
          )}

          {commitError !== null && (
            <ErrorNote
              error={commitError}
              onRetry={() => {
                void handleCommit();
              }}
              title="The import could not be committed."
            />
          )}

          {result && (
            <section className="panel">
              <div className="panel-pad">
                <EmptyState
                  actions={
                    <>
                      <Link className="btn primary" to="/inventory">
                        View inventory
                      </Link>
                      <Link className={buttonClass()} to="/imports">
                        Import another dataset
                      </Link>
                    </>
                  }
                  icon="i-check-circle"
                  title={`${result.appliedRows} ${DATASET_LABELS[result.dataset as ImportDataset] ?? result.dataset} rows imported`}
                >
                  {result.appliedRows} records applied, {result.skippedRows} skipped. No records
                  were deleted. Store data version is now {result.resultingStoreVersion}.
                </EmptyState>
              </div>
              <div className="panel-pad">
                <dl className="facts numeric">
                  <div>
                    <dt>Import id</dt>
                    <dd className="mono">{result.importId}</dd>
                  </div>
                  <div>
                    <dt>Committed at</dt>
                    <dd>{formatDate(result.committedAt)}</dd>
                  </div>
                  <div>
                    <dt>Resulting store version</dt>
                    <dd>{result.resultingStoreVersion}</dd>
                  </div>
                </dl>
              </div>
              <div className="panel-pad">
                <InlineNote tone="warn" title="Recheck earlier purchase plans.">
                  New stock data should invalidate outdated suggestions and approvals before export.
                  Your application owns this freshness check.
                </InlineNote>
              </div>
            </section>
          )}

          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>Your data foundations</h2>
                <p>Readiness from your live catalog, suppliers and risk views.</p>
              </div>
            </div>
            <div className="panel-pad">
              {readiness.loading ? (
                <LoadingRows label="Reading data readiness…" rows={2} />
              ) : readiness.error ? (
                <ErrorNote error={readiness.error} onRetry={readiness.reload} />
              ) : (
                <>
                  <div className="dataset-row">
                    <span className="dataset-icon">
                      <Icon name="i-box" />
                    </span>
                    <div className="grow">
                      <h3>Inventory snapshot</h3>
                      <p>
                        {readiness.data?.products.length ?? 0} products tracked
                        {latestSnapshot ? ` · snapshot ${formatDate(latestSnapshot)}` : ''}
                      </p>
                    </div>
                    <StatusPill
                      label={(readiness.data?.products.length ?? 0) > 0 ? 'Ready' : 'No data yet'}
                      tone={(readiness.data?.products.length ?? 0) > 0 ? 'good' : 'warn'}
                    />
                  </div>
                  <div className="dataset-row">
                    <span className="dataset-icon">
                      <Icon name="i-chart" />
                    </span>
                    <div className="grow">
                      <h3>Sales history</h3>
                      <p>
                        {salesThrough
                          ? `Sales through ${formatDate(salesThrough)}`
                          : 'No sales on record'}
                      </p>
                    </div>
                    <StatusPill
                      label={salesThrough ? 'Ready' : 'No data yet'}
                      tone={salesThrough ? 'good' : 'warn'}
                    />
                  </div>
                  <div className="dataset-row">
                    <span className="dataset-icon">
                      <Icon name="i-truck" />
                    </span>
                    <div className="grow">
                      <h3>Supplier directory</h3>
                      <p>{readiness.data?.suppliers.length ?? 0} supplier records</p>
                    </div>
                    <StatusPill
                      label={(readiness.data?.suppliers.length ?? 0) > 0 ? 'Ready' : 'No data yet'}
                      tone={(readiness.data?.suppliers.length ?? 0) > 0 ? 'good' : 'warn'}
                    />
                  </div>
                </>
              )}
            </div>
          </section>
        </div>

        <aside>
          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>A clean file, a clear decision.</h2>
              </div>
            </div>
            <div className="panel-pad stack">
              <p className="small muted">
                Keep one row per record and column names in the first row.
              </p>
              <ul className="checklist">
                <li>Use stable product and supplier IDs.</li>
                <li>Keep units consistent across datasets.</li>
                <li>Include dates and timezone context.</li>
                <li>Separate returns from gross sales.</li>
              </ul>
              <Disclosure open summary="View required columns">
                <p>
                  <strong>Inventory:</strong> sku, stock_on_hand, snapshot_date
                </p>
                <p>
                  <strong>Sales:</strong> sku, sale_date, quantity_sold
                </p>
              </Disclosure>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
