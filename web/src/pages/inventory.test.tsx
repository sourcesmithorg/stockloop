import { afterEach, describe, expect, it, vi } from 'vitest';

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { api, ApiError } from '@/lib/api';
import { AuthProvider } from '@/lib/auth';
import { mockApi } from '@/lib/mock';

import { InventoryPage } from './inventory';

function renderInventory() {
  return render(
    <MemoryRouter initialEntries={['/inventory']}>
      <AuthProvider>
        <InventoryPage />
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
    storeName: 'Inventory Test Store',
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

describe('inventory (live data)', () => {
  it('maps backend fields per row and keeps unknown distinct from verified zero', async () => {
    await seedOwner('inv-owner@example.test');
    renderInventory();

    const table = await screen.findByRole('table', { name: /Inventory list/ });
    // Caption names the table honestly.
    expect(table).toHaveTextContent('Inventory list: 6 of 6 products');

    // Measured product: stock + demand + lead + cover from their exact fields.
    const oat = rowFor('Oat milk 1 L');
    expect(within(oat).getByText('12 each')).toBeInTheDocument();
    expect(within(oat).getByText('4 / day')).toBeInTheDocument();
    expect(within(oat).getByText('5 days')).toBeInTheDocument();
    expect(within(oat).getByText('At risk')).toBeInTheDocument();

    // Verified zero sales is its own state: a real 0, never "no data".
    const tea = rowFor('Chamomile tea · 20 bags');
    expect(within(tea).getByText('22 each')).toBeInTheDocument();
    expect(within(tea).getByText('0 / day')).toBeInTheDocument();
    expect(within(tea).getByText('No recent sales')).toBeInTheDocument();
    expect(within(tea).getByText('Not estimated')).toBeInTheDocument();

    // Unknown inputs render as words — never 0, never healthy.
    const flour = rowFor('All-purpose flour 1 kg');
    expect(within(flour).getAllByText('Unknown')).toHaveLength(2); // stock + lead time
    expect(within(flour).getByText('No history')).toBeInTheDocument();
    expect(within(flour).getByText('Unavailable')).toBeInTheDocument();
    expect(within(flour).getByText('Data needed')).toBeInTheDocument();
  });

  it('filters by status and shows an honest empty-filter state', async () => {
    await seedOwner('inv-filter@example.test');
    renderInventory();
    await screen.findByRole('table', { name: /Inventory list/ });

    await userEvent.selectOptions(screen.getByLabelText('Stock status'), 'healthy');
    expect(screen.getByText('No matching products.')).toBeInTheDocument();
    expect(screen.queryByText('Oat milk 1 L')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(await screen.findByText('Oat milk 1 L')).toBeInTheDocument();
  });

  it('surfaces an API failure and retries without losing the screen', async () => {
    await seedOwner('inv-fail@example.test');
    vi.spyOn(api, 'getProducts').mockRejectedValueOnce(new ApiError(503, 'catalog offline'));
    renderInventory();

    expect(await screen.findByText('catalog offline')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Retry/ }));
    await waitFor(() => expect(screen.getByText('Oat milk 1 L')).toBeInTheDocument());
  });
});
