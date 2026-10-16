import { describe, expect, it } from 'vitest';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { AuthProvider } from '@/lib/auth';
import { mockApi } from '@/lib/mock';

import { ReorderPage } from './reorder';

function renderReorder() {
  return render(
    <MemoryRouter initialEntries={['/reorder']}>
      <AuthProvider>
        <ReorderPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

async function login(email: string, password = 'correct-horse-battery') {
  if (email === 'viewer@stockloop.test') {
    await mockApi.login({ email, password });
    return;
  }
  await mockApi.register({
    country: 'US',
    currency: 'USD',
    email,
    language: 'en',
    password,
    storeName: 'Reorder Test Store',
    timezone: 'UTC',
  });
}

function qtyInput(product: string): HTMLInputElement {
  return screen.getByRole('spinbutton', { name: `Proposed units for ${product}` });
}

describe('reorder studio (live plan)', () => {
  // File order matters: the mock plan is module state, so read-only checks run
  // before the mutation tests bump the version and approve the draft.
  it('renders the latest draft with per-currency subtotals and budget math', async () => {
    await login('ro-view@example.test');
    renderReorder();

    await screen.findByRole('table', { name: /Restock plan lines/ });
    expect(screen.getByText('Rule-based suggestions')).toBeInTheDocument();
    expect(screen.getByText('Draft · not approved')).toBeInTheDocument();

    // Per-supplier, per-currency subtotals — grouped, never summed across.
    const aside = screen.getByText('Your order, at a glance').closest('section');
    expect(aside).toHaveTextContent('Freshfield Foods');
    expect(aside).toHaveTextContent('$240.00 USD');
    expect(aside).toHaveTextContent('$144.00 USD');
    expect(aside).toHaveTextContent('Proposed total (USD)');
    expect(aside).toHaveTextContent('$384.00');

    // Budget meter: server-computed utilization with excluded-note honesty.
    expect(screen.getByRole('meter')).toBeInTheDocument();
    expect(screen.getByText(/76\.8%/)).toBeInTheDocument();
    expect(screen.getAllByText(/Tax and shipping are excluded/).length).toBeGreaterThan(0);

    // MOQ provenance is rule-derived and labeled.
    expect(screen.getByText('MOQ applied')).toBeInTheDocument();
    // Delivery-gap honesty in the review checklist.
    expect(screen.getByText(/ordering more does not close a delivery gap/)).toBeInTheDocument();
  });

  it('gates edit and approve actions for viewers with readable reasons', async () => {
    await login('viewer@stockloop.test', 'Stockloop123!');
    renderReorder();

    await screen.findByRole('table', { name: /Restock plan lines/ });
    expect(qtyInput('Oat milk 1 L')).toBeDisabled();
    const approve = screen.getByRole('button', { name: 'Approve plan' });
    expect(approve).toBeDisabled();
    expect(screen.getByText(/Viewers cannot approve plans/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save quantity' })).toBeNull();
  });

  it('saves an owner quantity edit and shows the server-recomputed totals', async () => {
    await login('ro-edit@example.test');
    renderReorder();

    await screen.findByRole('table', { name: /Restock plan lines/ });
    await userEvent.click(
      screen.getByRole('button', { name: 'Increase Proposed units for Oat milk 1 L' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save quantity for Oat milk 1 L' }));

    // Server math: 60 units × $2.50 = $150.00; totals recompute to $414.00.
    await waitFor(() => expect(screen.getAllByText('$150.00').length).toBeGreaterThan(0));
    const oatRow = screen.getByText('Oat milk 1 L').closest('tr');
    expect(oatRow).toHaveTextContent('Owner edit');
    expect(oatRow).toHaveTextContent('5 packs × 12 base units');
    const aside = screen.getByText('Your order, at a glance').closest('section');
    expect(aside).toHaveTextContent('$414.00');
  });

  it('rejects an off-pack quantity with the server rule and keeps the row editable', async () => {
    await login('ro-offpack@example.test');
    renderReorder();

    await screen.findByRole('table', { name: /Restock plan lines/ });
    const input = qtyInput('Oat milk 1 L');
    await userEvent.clear(input);
    await userEvent.type(input, '17');
    await userEvent.click(screen.getByRole('button', { name: 'Save quantity for Oat milk 1 L' }));

    expect(
      await screen.findByText(/multiple of the purchase pack \(12 units\)/),
    ).toBeInTheDocument();
    expect(input).toHaveValue(17); // the user's input is kept for correction
  });

  it('records an owner approval and links the generated documents', async () => {
    await login('ro-approve@example.test');
    renderReorder();

    await screen.findByRole('table', { name: /Restock plan lines/ });
    const approve = screen.getByRole('button', { name: 'Approve plan' });
    expect(approve).toBeDisabled();
    expect(
      screen.getByText('Confirm you reviewed quantities and delivery risks to enable approval.'),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('checkbox', { name: /I have reviewed quantities and delivery risks/ }),
    );
    await userEvent.click(approve);

    await waitFor(() => expect(screen.getByText('Plan approved.')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: 'PO-2026-0144' })).toBeInTheDocument();
    expect(screen.getByText('Approved · immutable')).toBeInTheDocument();
  }, 20_000);
});
