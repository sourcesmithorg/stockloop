import { afterEach, describe, expect, it, vi } from 'vitest';

// Real stylesheets for the rule assertion (vitest css:true) — same as
// inventory.test.tsx's focus-ring check.
import '@/styles/cornerstore.css';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { api, ApiError } from '@/lib/api';
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
    const timezone = screen.getByLabelText('Store timezone') as HTMLSelectElement;
    const status = screen.getByRole('status');
    const save = screen.getByRole('button', { name: /Save changes/ });

    expect(status).toHaveTextContent(/No unsaved changes/);
    expect(currency).toHaveValue('USD');
    expect(timezone).toHaveValue('UTC');

    await user.selectOptions(country, 'CA');
    expect(status).toHaveTextContent(/Unsaved changes/);
    // T-05: changing country does not change the display currency or the timezone.
    expect(currency).toHaveValue('USD');
    expect(timezone).toHaveValue('UTC');

    await user.click(save);
    await waitFor(() => expect(status).toHaveTextContent(/Changes saved/));
    expect(country).toHaveValue('CA');
    expect(currency).toHaveValue('USD');
    expect(timezone).toHaveValue('UTC');
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

function renderSettingsRoutes() {
  return render(
    <MemoryRouter initialEntries={['/settings']}>
      <AuthProvider>
        <Routes>
          <Route element={<h1>Standalone</h1>} path="/" />
          <Route element={<SettingsPage />} path="/settings" />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('settings account section and sign-out', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the #account section the header and sidebar link to', async () => {
    await seedRegistration('owner-account@example.test');
    renderSettings();
    const heading = await screen.findByRole('heading', { level: 2, name: 'Your account' });
    const section = heading.closest('section');
    // The app links avatar/profile to /settings#account — the anchor must exist.
    expect(section?.id).toBe('account');
    expect(section).toHaveTextContent('owner-account@example.test');
    expect(section).toHaveTextContent('Store owner');
    expect(within(section as HTMLElement).getByRole('button', { name: /Sign out/ })).toBeEnabled();
  }, 20_000);

  it('signing out clears the session and lands on the public page', async () => {
    await seedRegistration('owner-signout@example.test');
    renderSettingsRoutes();
    const button = await screen.findByRole('button', { name: /Sign out/ });
    await userEvent.setup().click(button);
    // Cleared session: navigation to the public page happened, and only then
    // is the mock session verifiably gone.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Standalone' }),
    ).toBeInTheDocument();
    await expect(mockApi.me()).rejects.toThrow();
  }, 20_000);

  it('a failed sign-out states the consequence even when the server sends a message', async () => {
    await seedRegistration('owner-signout-fail@example.test');
    vi.spyOn(api, 'logout').mockRejectedValue(new ApiError(502, '502 Bad Gateway on /auth/logout'));
    renderSettingsRoutes();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Sign out/ }));
    // Consequence first — raw status text alone never tells the user whether
    // they are still signed in; the server detail is appended for diagnosis.
    expect(
      await screen.findByText(
        'Sign-out did not happen — you are still signed in. (502 Bad Gateway on /auth/logout)',
      ),
    ).toBeInTheDocument();
    // Session kept: still on settings, still signed in (scoped to #account —
    // the members table lists the same email).
    const heading = screen.getByRole('heading', { level: 2, name: 'Your account' });
    expect(heading).toBeInTheDocument();
    const section = heading.closest('section');
    expect(
      within(section as HTMLElement).getByText('owner-signout-fail@example.test'),
    ).toBeInTheDocument();
  }, 20_000);

  it('renders the settings section nav with anchors only for sections that exist', async () => {
    await seedRegistration('owner-nav@example.test');
    renderSettings();
    const nav = await screen.findByRole('navigation', { name: 'Settings sections' });
    const hrefs = within(nav)
      .getAllByRole('link')
      .map((link) => link.getAttribute('href') ?? '');
    // Every nav anchor resolves to a section this app renders — no dead links.
    expect(hrefs).toEqual(['#region', '#members', '#account']);
    for (const href of hrefs) {
      expect(document.getElementById(href.slice(1))).not.toBeNull();
    }
  }, 20_000);

  it('keeps the settings grid at exactly two children (nav + wrapper) like the reference', async () => {
    await seedRegistration('owner-grid@example.test');
    renderSettings();
    const nav = await screen.findByRole('navigation', { name: 'Settings sections' });
    const grid = nav.parentElement as HTMLElement | null;
    expect(grid).not.toBeNull();
    expect(grid?.className).toContain('settings-grid');
    // Reference structure (.template/settings.html:501-516): the grid holds
    // ONLY the nav and one wrapper div holding every section. A third direct
    // child would wrap a section into the 170px nav track.
    const children = Array.from(grid?.children ?? []);
    expect(children).toHaveLength(2);
    expect(children[0]).toBe(nav);
    expect(children[1].tagName).toBe('DIV');
    expect(children[1].querySelectorAll('section')).toHaveLength(3);
  }, 20_000);

  it('lets the settings wrapper shrink below the members table min-width (narrow-viewport overflow)', async () => {
    await seedRegistration('owner-overflow@example.test');
    renderSettings();
    const nav = await screen.findByRole('navigation', { name: 'Settings sections' });
    const wrapper = nav.parentElement?.children[1] as HTMLElement;
    expect(wrapper).toBeTruthy();
    // jsdom has no layout engine, so grid min-content flooring cannot be
    // observed here — the shipped rule text is the authority (same pattern as
    // the inventory focus-ring test). The browser pass measures real overflow.
    const ruleShipped = Array.from(document.styleSheets).some((sheet) => {
      try {
        return Array.from(sheet.cssRules).some((rule) => {
          // Whitespace-normalized so the check is independent of how the
          // CSSOM serializer spaces the authored `.settings-grid>div`.
          const text = rule.cssText.replace(/\s+/g, '');
          return text.includes('.settings-grid>div') && text.includes('min-width:0');
        });
      } catch {
        return false;
      }
    });
    expect(ruleShipped).toBe(true);
    // And it applies to this wrapper: computed min-width resolves to 0.
    expect(['0', '0px']).toContain(window.getComputedStyle(wrapper).minWidth);
  }, 20_000);

  it('a failed sign-out with an empty error message still tells the user the truth', async () => {
    await seedRegistration('owner-signout-empty@example.test');
    // Network-layer failures can carry an empty message — the old code rendered
    // a silent no-op. The fallback must state the consequence.
    vi.spyOn(api, 'logout').mockRejectedValue(new TypeError(''));
    renderSettingsRoutes();
    await userEvent.setup().click(await screen.findByRole('button', { name: /Sign out/ }));
    expect(await screen.findByText(/Sign-out did not happen/)).toBeInTheDocument();
    expect(screen.getByText(/still signed in/)).toBeInTheDocument();
    // Session kept: still on settings.
    expect(screen.getByRole('heading', { level: 2, name: 'Your account' })).toBeInTheDocument();
  }, 20_000);
});
