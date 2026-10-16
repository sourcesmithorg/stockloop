import { describe, expect, it } from 'vitest';

import { render, screen, waitFor, within } from '@testing-library/react';
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

/** Register switches the mock session, so end on the owner's login. */
async function seedOwnerWithTeammate(ownerEmail: string, teammateEmail: string) {
  await seedRegistration(ownerEmail);
  await seedRegistration(teammateEmail);
  await mockApi.login({ email: ownerEmail, password: 'correct-horse-battery' });
  await mockApi.addStoreMember({ email: teammateEmail, role: 'operator' });
}

/** The members fetch runs after AuthProvider's session read; under parallel
 * suite load that stacks past the default 1s findBy timeout. */
function findMembersTable() {
  return screen.findByRole('table', { name: /Store members/ }, { timeout: 10_000 });
}

describe('settings store members (owner-managed)', () => {
  it('lists seeded members with role, status and a you marker on your own row', async () => {
    await seedOwnerWithTeammate('owner-list@example.test', 'teammate-list@example.test');
    renderSettings();

    const table = await findMembersTable();
    expect(within(table).getByText('teammate-list@example.test')).toBeInTheDocument();
    expect(within(table).getByText('owner-list@example.test')).toBeInTheDocument();
    expect(within(table).getByText(/\(you\)/)).toBeInTheDocument();
    expect(within(table).getAllByText('active')).toHaveLength(2);
    const teammateRole = screen.getByLabelText(
      'Role for teammate-list@example.test',
    ) as HTMLSelectElement;
    expect(teammateRole).toHaveValue('operator');
  }, 20_000);

  it('adds a member, shows the no-email-sent message and the new row', async () => {
    const user = userEvent.setup();
    await seedRegistration('owner-add@example.test');
    await seedRegistration('teammate-add@example.test');
    await mockApi.login({ email: 'owner-add@example.test', password: 'correct-horse-battery' });
    renderSettings();
    await findMembersTable();

    await user.type(screen.getByLabelText('Email'), 'teammate-add@example.test');
    await user.selectOptions(screen.getByLabelText('Role'), 'viewer');
    await user.click(screen.getByRole('button', { name: /Add member/ }));

    // The backend message states plainly that nobody was contacted.
    expect(await screen.findByText(/No email was sent — nobody was contacted/)).toBeInTheDocument();
    const table = await findMembersTable();
    expect(within(table).getByText('teammate-add@example.test')).toBeInTheDocument();
  }, 20_000);

  it('surfaces the 409 already_member error when adding a duplicate', async () => {
    const user = userEvent.setup();
    await seedOwnerWithTeammate('owner-dupe@example.test', 'teammate-dupe@example.test');
    renderSettings();
    await findMembersTable();

    await user.type(screen.getByLabelText('Email'), 'teammate-dupe@example.test');
    await user.click(screen.getByRole('button', { name: /Add member/ }));

    expect(
      await screen.findByText('This email is already an active member of the store.'),
    ).toBeInTheDocument();
  }, 20_000);

  it('requires a confirmation step before revoking, then revokes', async () => {
    const user = userEvent.setup();
    await seedOwnerWithTeammate('owner-revoke@example.test', 'teammate-revoke@example.test');
    renderSettings();

    const table = await findMembersTable();
    const teammateRow = within(table).getByText('teammate-revoke@example.test').closest('tr');
    expect(teammateRow).not.toBeNull();

    await user.click(within(teammateRow as HTMLElement).getByRole('button', { name: 'Revoke' }));
    // Confirmation copy states the immediate effect, including the session.
    expect(
      within(teammateRow as HTMLElement).getByText(
        'Ends their access and active session immediately.',
      ),
    ).toBeInTheDocument();

    await user.click(
      within(teammateRow as HTMLElement).getByRole('button', { name: 'Confirm revoke' }),
    );
    expect(await screen.findByText(/Access revoked for teammate-revoke/)).toBeInTheDocument();
    await waitFor(() =>
      expect(within(teammateRow as HTMLElement).getByText('revoked')).toBeInTheDocument(),
    );
  }, 20_000);

  it('changes a role and states that the change takes effect immediately', async () => {
    const user = userEvent.setup();
    await seedOwnerWithTeammate('owner-role@example.test', 'teammate-role@example.test');
    renderSettings();
    await findMembersTable();

    await user.selectOptions(
      screen.getByLabelText('Role for teammate-role@example.test'),
      'viewer',
    );

    expect(
      await screen.findByText(/takes effect immediately — the person keeps or loses access/),
    ).toBeInTheDocument();
    expect(
      (screen.getByLabelText('Role for teammate-role@example.test') as HTMLSelectElement).value,
    ).toBe('viewer');
  }, 20_000);

  it('shows a read-only note and no manage controls for non-owners', async () => {
    // The seeded viewer demo account (role: viewer) is not the store owner.
    await mockApi.login({ email: 'viewer@stockloop.test', password: 'Stockloop123!' });
    renderSettings();

    await findMembersTable();
    expect(screen.getByText('Only the store owner can manage members.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add member/ })).toBeNull();
    expect(screen.queryByLabelText(/^Role for /)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Revoke' })).toBeNull();
  }, 20_000);
});
