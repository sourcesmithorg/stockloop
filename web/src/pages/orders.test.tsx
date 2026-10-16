import { afterEach, describe, expect, it, vi } from 'vitest';

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { api, ApiError } from '@/lib/api';
import { AuthProvider } from '@/lib/auth';
import { mockApi } from '@/lib/mock';

import { OrdersPage } from './orders';

function renderOrders() {
  return render(
    <MemoryRouter initialEntries={['/orders']}>
      <AuthProvider>
        <OrdersPage />
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
    storeName: 'Orders Test Store',
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

describe('purchase orders (live data)', () => {
  it('maps order documents: totals keep currency, status carries text', async () => {
    await seedOwner('po-owner@example.test');
    renderOrders();

    const table = await screen.findByRole('table', { name: /Purchase-order history/ });
    expect(table).toHaveTextContent('Purchase-order history: 3 of 3 orders');

    const freshfield = rowFor('PO-2026-0142');
    expect(within(freshfield).getByText('Freshfield Foods')).toBeInTheDocument();
    expect(within(freshfield).getByText('2 products · 78 units')).toBeInTheDocument();
    // Money never loses its currency; tax treatment is stated, not implied.
    expect(within(freshfield).getByText('$240.00 USD')).toBeInTheDocument();
    expect(within(freshfield).getByText(/Tax excluded · Shipping excluded/)).toBeInTheDocument();
    expect(within(freshfield).getByText('Approved')).toBeInTheDocument();

    // Superseded documents read as stale, not as quietly-approved.
    const stale = rowFor('PO-2026-0138');
    expect(within(stale).getByText('Needs refresh')).toBeInTheDocument();

    expect(screen.getByText(/Export is not order placement/)).toBeInTheDocument();
  });

  it('searches by supplier and shows an honest no-match state', async () => {
    await seedOwner('po-search@example.test');
    renderOrders();
    await screen.findByRole('table', { name: /Purchase-order history/ });

    await userEvent.type(screen.getByLabelText('Search purchase orders'), 'daily');
    expect(screen.queryByText('PO-2026-0142')).toBeNull();
    expect(screen.getByText('PO-2026-0143')).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText('Search purchase orders'));
    await userEvent.type(screen.getByLabelText('Search purchase orders'), 'zzz');
    expect(screen.getByText('No matching orders.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(await screen.findByText('PO-2026-0142')).toBeInTheDocument();
  });

  it('surfaces an API failure and retries into live data', async () => {
    await seedOwner('po-fail@example.test');
    vi.spyOn(api, 'getOrders').mockRejectedValueOnce(new ApiError(500, 'orders unavailable'));
    renderOrders();

    expect(await screen.findByText('orders unavailable')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Retry/ }));
    await waitFor(() => expect(screen.getByText('PO-2026-0142')).toBeInTheDocument());
  });
});
