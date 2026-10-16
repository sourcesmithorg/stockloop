import { afterEach, describe, expect, it, vi } from 'vitest';

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { api, ApiError } from '@/lib/api';
import { AuthProvider } from '@/lib/auth';
import { mockApi } from '@/lib/mock';

import { SuppliersPage } from './suppliers';

function renderSuppliers() {
  return render(
    <MemoryRouter initialEntries={['/suppliers']}>
      <AuthProvider>
        <SuppliersPage />
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
    storeName: 'Suppliers Test Store',
    timezone: 'UTC',
  });
}

function rowFor(name: string): HTMLElement {
  const row = screen.getByText(name).closest('tr');
  if (!row) throw new Error(`no table row contains ${name}`);
  return row;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('suppliers (live data)', () => {
  it('derives readiness and per-supplier product counts from live reads', async () => {
    await seedOwner('sup-owner@example.test');
    renderSuppliers();

    const table = await screen.findByRole('table', { name: /Supplier directory/ });
    expect(table).toHaveTextContent('Supplier directory: 2 of 2 suppliers');

    // Complete record: calendar, contact, verification all present.
    const freshfield = rowFor('Freshfield Foods');
    expect(within(freshfield).getByText('5 days')).toBeInTheDocument();
    expect(
      within(freshfield).getByText(/Delivery days: Mon, Tue, Wed, Thu, Fri/),
    ).toBeInTheDocument();
    expect(within(freshfield).getByText('Complete')).toBeInTheDocument();
    // Product counts are counted from GET /products, not invented.
    expect(within(freshfield).getByText('2')).toBeInTheDocument();

    // Missing calendar is a named gap with a warn pill — not a silent default.
    const daily = rowFor('Daily Goods Co.');
    expect(within(daily).getByText('Setup needed')).toBeInTheDocument();
    expect(within(daily).getByText('No delivery calendar')).toBeInTheDocument();
    expect(within(daily).getByText('3')).toBeInTheDocument();

    expect(screen.getByText(/never silently combined/)).toBeInTheDocument();
  });

  it('shows an honest empty state when the store has no suppliers', async () => {
    await seedOwner('sup-empty@example.test');
    vi.spyOn(api, 'getSuppliers').mockResolvedValue([]);
    renderSuppliers();

    expect(await screen.findByText('No suppliers yet.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('surfaces an API failure and retries into live data', async () => {
    await seedOwner('sup-fail@example.test');
    vi.spyOn(api, 'getSuppliers').mockRejectedValueOnce(new ApiError(500, 'directory offline'));
    renderSuppliers();

    expect(await screen.findByText('directory offline')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Retry/ }));
    await waitFor(() => expect(screen.getByText('Freshfield Foods')).toBeInTheDocument());
  });
});
