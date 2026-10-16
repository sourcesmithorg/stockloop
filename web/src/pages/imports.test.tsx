import { afterEach, describe, expect, it, vi } from 'vitest';

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { api, ApiError } from '@/lib/api';
import { AuthProvider } from '@/lib/auth';
import { mockApi } from '@/lib/mock';

import { ImportsPage } from './imports';

function renderImports() {
  return render(
    <MemoryRouter initialEntries={['/imports']}>
      <AuthProvider>
        <ImportsPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

async function seedOwner(email: string) {
  await mockApi.register({
    country: 'US',
    currency: 'USD',
    email,
    language: 'en',
    password: 'correct-horse-battery',
    storeName: 'Imports Test Store',
    timezone: 'UTC',
  });
}

function csvFile(name: string, body: string): File {
  return new File([body], name, { type: 'text/csv' });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('data imports (live preview/commit)', () => {
  it('shows data readiness from live catalog, supplier and risk reads', async () => {
    await seedOwner('im-owner@example.test');
    renderImports();

    const foundations = (await screen.findByText('Your data foundations')).closest('section');
    expect(foundations).toHaveTextContent('6 products tracked');
    expect(foundations).toHaveTextContent('2 supplier records');
    // Freshness comes from sourceVersions.salesThrough, not a guess.
    expect(foundations).toHaveTextContent('Sales through Oct 12, 2026');
  });

  it('blocks a bad file with row-level issues and keeps import disabled', async () => {
    await seedOwner('im-blocked@example.test');
    renderImports();
    await screen.findByText('Your data foundations');

    const file = csvFile('stock.csv', 'sku,stock_on_hand,snapshot_date\nSKU-999,-4,2026-10-16\n');
    await userEvent.upload(screen.getByLabelText('CSV file'), file);
    await userEvent.click(screen.getByRole('button', { name: 'Validate file' }));

    expect(await screen.findByText('Blocked')).toBeInTheDocument();
    expect(screen.getByText(/need correction before import/)).toBeInTheDocument();
    const issues = screen.getByRole('table', {
      name: 'Import validation errors and warnings',
    });
    expect(within(issues).getByText('stock_on_hand')).toBeInTheDocument();
    expect(within(issues).getByText('SKU-999')).toBeInTheDocument();
    expect(within(issues).getByText('-4')).toBeInTheDocument();
    expect(within(issues).getAllByText('Blocking')).toHaveLength(2);

    const commit = screen.getByRole('button', { name: 'Import 0 rows' });
    expect(commit).toBeDisabled();
    expect(screen.getByText('Import is blocked in this state.')).toBeInTheDocument();
  });

  it('commits a validated file and reports the real counts', async () => {
    await seedOwner('im-valid@example.test');
    renderImports();
    await screen.findByText('Your data foundations');

    const file = csvFile('stock.csv', 'sku,stock_on_hand,snapshot_date\nSKU-001,12,2026-10-16\n');
    await userEvent.upload(screen.getByLabelText('CSV file'), file);
    await userEvent.click(screen.getByRole('button', { name: 'Validate file' }));

    expect(await screen.findByText('Validated')).toBeInTheDocument();
    expect(screen.getByText(/Nothing is committed until you press Import/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Import 1 rows' }));
    expect(await screen.findByText('1 Inventory snapshot rows imported')).toBeInTheDocument();
    expect(screen.getByText(/Store data version is now/)).toBeInTheDocument();
    expect(screen.getByText(/Recheck earlier purchase plans/)).toBeInTheDocument();
  }, 20_000);

  it('gates imports for viewers with a readable reason', async () => {
    await mockApi.login({ email: 'viewer@stockloop.test', password: 'Stockloop123!' });
    renderImports();

    await screen.findByText('Your data foundations');
    expect(screen.getByText(/Viewers cannot import data/)).toBeInTheDocument();
    const validate = screen.getByRole('button', { name: 'Validate file' });
    expect(validate).toBeDisabled();
    expect(validate).toHaveAccessibleDescription(
      'Viewers cannot import data — an operator or owner must run imports.',
    );
  });

  it('surfaces a preview failure without losing the selected file', async () => {
    await seedOwner('im-fail@example.test');
    renderImports();
    await screen.findByText('Your data foundations');

    vi.spyOn(api, 'previewImport').mockRejectedValueOnce(
      new ApiError(500, 'validation service unavailable'),
    );
    const file = csvFile('stock.csv', 'sku,stock_on_hand,snapshot_date\n');
    await userEvent.upload(screen.getByLabelText('CSV file'), file);
    await userEvent.click(screen.getByRole('button', { name: 'Validate file' }));

    expect(await screen.findByText('validation service unavailable')).toBeInTheDocument();
    expect(screen.getByText(/Selected: stock\.csv/)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Validate file' })).toBeEnabled(),
    );
  });
});
