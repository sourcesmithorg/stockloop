import { afterEach, describe, expect, it, vi } from 'vitest';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { api, ApiError } from '@/lib/api';
import { AuthProvider } from '@/lib/auth';
import { mockApi } from '@/lib/mock';

import { OverviewPage } from './overview';

function renderOverview() {
  return render(
    <MemoryRouter initialEntries={['/overview']}>
      <AuthProvider>
        <OverviewPage />
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
    storeName: 'Evidence Test Store',
    timezone: 'UTC',
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('overview (live data)', () => {
  it('renders the store snapshot and priority table from API field values', async () => {
    await seedOwner('ov-owner@example.test');
    renderOverview();

    // Summary strip: real counts, not fixture copy.
    await screen.findByText('Products tracked');
    const snapshot = screen.getByRole('region', { name: 'Store snapshot' });
    expect(snapshot).toHaveTextContent('Products tracked');
    expect(snapshot).toHaveTextContent('6'); // six fixture products
    expect(snapshot).toHaveTextContent('Restock suggestions');
    expect(snapshot).toHaveTextContent('2 at risk · 2 running low');
    expect(snapshot).toHaveTextContent('USD · This purchasing cycle');

    // Priority table: oat milk row maps stock/demand/cover/risk fields.
    const table = await screen.findByRole('table', { name: /Priority inventory/ });
    const oatRow = screen.getByText('Oat milk 1 L').closest('tr');
    expect(oatRow).toHaveTextContent('12 each'); // risk.stock.value + unit
    expect(oatRow).toHaveTextContent('4 / day'); // averageDailyDemand
    expect(oatRow).toHaveTextContent('3 days'); // coverDays.value
    expect(oatRow).toHaveTextContent('At risk'); // riskState pill text
    expect(table).toHaveTextContent('Jasmine rice 1 kg');
    // Unknown products are never fabricated as zero: flour (dataNeeded) is not
    // a restock suggestion and must not appear with invented numbers.
    expect(screen.queryByText('All-purpose flour 1 kg')).toBeNull();
  });

  it('shows the latest plan totals per currency in the restock rail', async () => {
    await seedOwner('ov-rail@example.test');
    renderOverview();

    await waitFor(() => expect(screen.getByText('$384.00')).toBeInTheDocument());
    const rail = screen.getByRole('complementary').textContent ?? '';
    expect(rail).toContain('$116.00 remains in your USD budget');
    // Delivery-gap honesty: unconfirmed estimates stay flagged.
    expect(rail).toMatch(/ordering more does not close a delivery gap/);
  });

  it('surfaces an API failure with the server message and retries into live data', async () => {
    await seedOwner('ov-fail@example.test');
    vi.spyOn(api, 'getProducts').mockRejectedValueOnce(new ApiError(500, 'risk view unavailable'));
    renderOverview();

    expect(await screen.findByText('risk view unavailable')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Retry/ }));
    // Retry refetches (second call passes through to the fixture API).
    expect(await screen.findByRole('table', { name: /Priority inventory/ })).toBeInTheDocument();
    expect(screen.queryByText('risk view unavailable')).toBeNull();
  });
});
