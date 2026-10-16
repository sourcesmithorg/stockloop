import { describe, expect, it } from 'vitest';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { AuthProvider } from '@/lib/auth';
import { mockApi } from '@/lib/mock';
import { SettingsPage } from '@/pages/settings';
function renderSettings() {
  return render(
    <MemoryRouter initialEntries={['/settings']}>
      <AuthProvider>
        <SettingsPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

function seedRegistration(email: string) {
  return mockApi.register({
    country: 'US',
    currency: 'USD',
    email,
    language: 'en',
    password: 'correct-horse-battery',
    storeName: 'Maple & Main',
    timezone: 'UTC',
  });
}

describe('settings regional save flow (T-05)', () => {
  it('tracks dirty → saving → success and keeps currency independent of country', async () => {
    const user = userEvent.setup();
    await seedRegistration('owner-save@example.test');
    renderSettings();

    const country = (await screen.findByLabelText('Store country')) as HTMLSelectElement;
    const currency = screen.getByLabelText('Display currency') as HTMLSelectElement;
    const status = screen.getByRole('status');
    const save = screen.getByRole('button', { name: /Save changes/ });

    expect(status).toHaveTextContent(/No unsaved changes/);
    expect(currency).toHaveValue('USD');

    await user.selectOptions(country, 'CA');
    expect(status).toHaveTextContent(/Unsaved changes/);
    // T-05: changing country does not change the display currency.
    expect(currency).toHaveValue('USD');

    await user.click(save);
    await waitFor(() => expect(status).toHaveTextContent(/Changes saved/));
    expect(country).toHaveValue('CA');
    expect(currency).toHaveValue('USD');
  }, 20_000);

  it('surfaces a version conflict with the current version and retries after re-fetch', async () => {
    const user = userEvent.setup();
    await seedRegistration('owner-conflict@example.test');
    renderSettings();

    const country = (await screen.findByLabelText('Store country')) as HTMLSelectElement;
    const status = screen.getByRole('status');

    // Simulate a concurrent external edit so the store version is now stale.
    const { store } = await mockApi.getStore();
    await mockApi.updateStore({
      country: 'US',
      expectedVersion: store.version,
      name: 'Elsewhere',
      timezone: 'UTC',
    });

    await user.selectOptions(country, 'GB');
    await user.click(screen.getByRole('button', { name: /Save changes/ }));
    const currentVersion = (await mockApi.getStore()).store.version;
    await waitFor(() => expect(status).toHaveTextContent(new RegExp(`version ${currentVersion}`)));
    expect(status).toHaveTextContent(/Version conflict/);
    // The user's input is retained for retry.
    expect(country).toHaveValue('GB');

    await user.click(screen.getByRole('button', { name: /Retry save/ }));
    await waitFor(() => expect(status).toHaveTextContent(/Changes saved/));
    expect(country).toHaveValue('GB');
  }, 20_000);
});
