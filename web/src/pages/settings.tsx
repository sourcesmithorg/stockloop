import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { PageHead } from '@/components/layout/page-head';
import { Icon } from '@/components/layout/icon';
import {
  Button,
  EmptyState,
  ErrorNote,
  Field,
  InlineNote,
  Input,
  Select,
  Table,
} from '@/components/ui';
import { StatusPill } from '@/components/ui/status-pill';
import {
  api,
  ApiError,
  type Preferences,
  type Store,
  type StoreMember,
  type StoreRole,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { COUNTRIES, CURRENCIES, LANGUAGES, TIMEZONES } from '@/lib/region-data';
import { useApi } from '@/lib/use-api';
import { usePageTitle } from '@/lib/use-page-title';

/** Regional settings — .template/settings.html (#region). Country and display
 * currency are independent: changing one never rewrites the other (T-05). */
export function SettingsPage() {
  usePageTitle('Settings');
  const { store, preferences } = useAuth();
  return (
    <>
      <PageHead
        description="Practical preferences for the way your store works."
        eyebrow="Settings"
        title="Make yourself at home."
      />
      {store && preferences ? (
        <div className="settings-grid">
          {/* .template/settings.html #settings-menu: nav fills the 170px
              column; sections flow down column 2. Anchors only for sections
              this app actually renders — never dead links. */}
          <nav aria-label="Settings sections" className="settings-menu">
            <a href="#region">Region &amp; language</a>
            <a href="#members">Members</a>
            <a href="#account">Your account</a>
          </nav>
          {/* Reference structure (.template/settings.html:516): the sections
              live in ONE wrapper div, so the grid has exactly two children
              (nav + wrapper) and no section can ever land in the 170px nav
              track via auto-placement wrap. */}
          <div>
            <RegionForm initialPreferences={preferences} initialStore={store} />
            <MembersSection />
            <AccountSection />
          </div>
        </div>
      ) : (
        <p className="small muted">Loading settings…</p>
      )}
    </>
  );
}

interface FormState {
  country: string;
  language: string;
  currency: string;
  timezone: string;
}

type SavePhase = 'idle' | 'saving' | 'success' | 'error' | 'conflict';

interface SaveState {
  phase: SavePhase;
  message?: string;
  currentVersion?: number;
}

function RegionForm({
  initialStore,
  initialPreferences,
}: {
  initialStore: Store;
  initialPreferences: Preferences;
}) {
  const { updateStore, updatePreferences, refresh } = useAuth();

  const [country, setCountry] = useState(initialStore.countryCode);
  // Unset preference fields arrive as null — fall back to the store's values.
  const initialLanguage = initialPreferences.locale ?? initialStore.locale;
  const initialCurrency = initialPreferences.displayCurrency ?? initialStore.defaultCurrency;
  const [language, setLanguage] = useState(initialLanguage);
  const [currency, setCurrency] = useState(initialCurrency);
  const [timezone, setTimezone] = useState(initialStore.timezone);
  // Last known-saved form state: dirty = any field differs from it.
  const [baseline, setBaseline] = useState<FormState>({
    country: initialStore.countryCode,
    language: initialLanguage,
    currency: initialCurrency,
    timezone: initialStore.timezone,
  });
  const [save, setSave] = useState<SaveState>({ phase: 'idle' });

  const dirty =
    country !== baseline.country ||
    language !== baseline.language ||
    currency !== baseline.currency ||
    timezone !== baseline.timezone;

  function touch<T>(setter: (value: T) => void, value: T) {
    setter(value);
    setSave({ phase: 'idle' });
  }

  async function handleSave() {
    setSave({ phase: 'saving' });
    try {
      if (save.phase === 'conflict') {
        // Version conflict: re-fetch the latest versions, then re-apply this
        // form's values (the inputs stay untouched on screen).
        await refresh();
      }
      const storePatch: { country?: string; timezone?: string } = {};
      if (country !== baseline.country) storePatch.country = country;
      if (timezone !== baseline.timezone) storePatch.timezone = timezone;
      const preferencesPatch: { locale?: string; displayCurrency?: string } = {};
      if (language !== baseline.language) preferencesPatch.locale = language;
      if (currency !== baseline.currency) preferencesPatch.displayCurrency = currency;
      if (Object.keys(storePatch).length > 0) await updateStore(storePatch);
      if (Object.keys(preferencesPatch).length > 0) await updatePreferences(preferencesPatch);
      setBaseline({ country, language, currency, timezone });
      setSave({ phase: 'success' });
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) {
        setSave({ phase: 'conflict', currentVersion: caught.currentVersion });
      } else {
        setSave({
          phase: 'error',
          message:
            caught instanceof ApiError
              ? caught.message
              : 'Could not save your changes. Check your connection and retry.',
        });
      }
    }
  }

  const statusText =
    save.phase === 'saving'
      ? 'Saving…'
      : save.phase === 'error'
        ? save.message
        : save.phase === 'conflict'
          ? `Version conflict — someone else changed this store (current version ${
              save.currentVersion ?? 'unknown'
            }). Retry re-loads it, then saves your changes.`
          : dirty
            ? 'Unsaved changes.'
            : save.phase === 'success'
              ? 'Changes saved.'
              : 'No unsaved changes.';

  return (
    <section className="panel panel-pad settings-section" id="region">
      <h2>Your region. Your terms.</h2>
      <p className="muted">
        Country and currency are independent preferences. English and USD are the defaults.
      </p>
      <div className="field-grid two">
        <Field
          help="ISO country choices. No currency is inferred or converted."
          label="Store country"
        >
          <Select onChange={(event) => touch(setCountry, event.target.value)} value={country}>
            {COUNTRIES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          help="The screens remain English until translations exist."
          label="Interface language"
        >
          <Select onChange={(event) => touch(setLanguage, event.target.value)} value={language}>
            {LANGUAGES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field help="Amounts display in this currency after integration." label="Display currency">
          <Select onChange={(event) => touch(setCurrency, event.target.value)} value={currency}>
            {CURRENCIES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field help="Used for sales windows and delivery-date cutoffs." label="Store timezone">
          <Select onChange={(event) => touch(setTimezone, event.target.value)} value={timezone}>
            {TIMEZONES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="mt-24">
        <InlineNote tone="warn" title="Changing currency is not currency conversion.">
          Keep historic orders in their original currency. Resolve supplier-currency mismatches
          before approval; do not re-label previous amounts.
        </InlineNote>
      </div>
      <div className="form-actions">
        <span aria-live="polite" className="small muted" role="status">
          {statusText}
        </span>
        <Button
          disabled={!dirty}
          loading={save.phase === 'saving'}
          loadingLabel="Saving…"
          onClick={() => {
            void handleSave();
          }}
          type="button"
          variant="primary"
        >
          <Icon name="i-check" />
          {save.phase === 'error' || save.phase === 'conflict' ? 'Retry save' : 'Save changes'}
        </Button>
      </div>
    </section>
  );
}

const ROLE_OPTIONS: StoreRole[] = ['owner', 'operator', 'viewer'];

/** Store membership — GET/POST/PATCH/DELETE /api/store/members. Owners
 * manage; everyone on the team sees who has access. No email is sent on add. */
function MembersSection() {
  const { user } = useAuth();
  const members = useApi(() => api.getStoreMembers(), []);
  const canManage = user?.role === 'owner';

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<StoreRole>('operator');
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const rows = members.data ?? [];

  function messageOf(caught: unknown, fallback: string): string {
    return caught instanceof ApiError ? caught.message : fallback;
  }

  async function handleAdd() {
    setAdding(true);
    setNotice(null);
    try {
      const result = await api.addStoreMember({ email: email.trim(), role });
      setEmail('');
      // Re-read the list so a reactivated (previously revoked) member cannot
      // appear twice.
      members.reload();
      setNotice({ tone: 'good', text: result.message });
    } catch (caught) {
      setNotice({
        tone: 'bad',
        text: messageOf(caught, 'Could not add this member. Check the email and retry.'),
      });
    } finally {
      setAdding(false);
    }
  }

  async function changeRole(member: StoreMember, nextRole: StoreRole) {
    if (nextRole === member.role) return;
    setBusyId(member.id);
    setRowError(null);
    try {
      const updated = await api.updateStoreMemberRole(member.id, nextRole);
      members.setData(rows.map((row) => (row.id === updated.id ? updated : row)));
      setNotice({
        tone: 'good',
        text: `Role changed to ${updated.role}. Changing a role takes effect immediately — the person keeps or loses access from their next request.`,
      });
    } catch (caught) {
      setRowError(messageOf(caught, 'Could not change this role. The previous role is unchanged.'));
    } finally {
      setBusyId(null);
    }
  }

  async function confirmRevoke(member: StoreMember) {
    setBusyId(member.id);
    setRowError(null);
    try {
      await api.revokeStoreMember(member.id);
      members.setData(
        rows.map((row) => (row.id === member.id ? { ...row, status: 'revoked' } : row)),
      );
      setConfirmingId(null);
      setNotice({
        tone: 'good',
        text: `Access revoked for ${member.email}. This took effect immediately, including ending their active session.`,
      });
    } catch (caught) {
      setRowError(messageOf(caught, 'Could not revoke this member. Their access is unchanged.'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="panel panel-pad settings-section" id="members">
      <h2>Who works here.</h2>
      <p className="muted">
        Members sign in with their own account. Nobody is emailed automatically — share access with
        people directly.
      </p>
      {!canManage && (
        <div className="mt-24">
          <InlineNote tone="neutral" title="Only the store owner can manage members.">
            You can see the team, but adding people, changing roles and revoking access is up to the
            owner.
          </InlineNote>
        </div>
      )}
      {members.loading ? (
        <p className="small muted">Loading members…</p>
      ) : members.error ? (
        <ErrorNote error={members.error} onRetry={members.reload} />
      ) : rows.length === 0 ? (
        <EmptyState icon="i-store" title="No teammates yet.">
          Add a teammate by email once they have an account. Membership is recorded, not emailed.
        </EmptyState>
      ) : (
        <Table caption={`Store members: ${rows.length}`} label="Store members" minWidth={640}>
          <thead>
            <tr>
              <th scope="col">Member</th>
              <th scope="col">Role</th>
              <th scope="col">Status</th>
              {canManage && <th scope="col">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((member) => (
              <tr key={member.id}>
                <td>
                  {member.email}
                  {member.id === user?.id && <span className="sub"> (you)</span>}
                </td>
                <td>
                  {canManage && member.status === 'active' ? (
                    <Select
                      aria-label={`Role for ${member.email}`}
                      disabled={busyId === member.id}
                      onChange={(event) => {
                        void changeRole(member, event.target.value as StoreRole);
                      }}
                      value={member.role}
                    >
                      {ROLE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    member.role
                  )}
                </td>
                <td>
                  <StatusPill
                    label={member.status}
                    tone={member.status === 'active' ? 'good' : 'neutral'}
                  />
                </td>
                {canManage && (
                  <td>
                    {member.status === 'active' &&
                      (confirmingId === member.id ? (
                        <span className="row">
                          <span className="small muted">
                            Ends their access and active session immediately.
                          </span>
                          <Button
                            loading={busyId === member.id}
                            onClick={() => {
                              void confirmRevoke(member);
                            }}
                            size="sm"
                            variant="danger"
                          >
                            Confirm revoke
                          </Button>
                          <Button
                            disabled={busyId === member.id}
                            onClick={() => setConfirmingId(null)}
                            size="sm"
                          >
                            Cancel
                          </Button>
                        </span>
                      ) : (
                        <Button
                          disabled={busyId === member.id}
                          onClick={() => setConfirmingId(member.id)}
                          size="sm"
                        >
                          <Icon name="i-trash" />
                          Revoke
                        </Button>
                      ))}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {rowError && (
        <div className="mt-24">
          <InlineNote tone="bad">{rowError}</InlineNote>
        </div>
      )}
      {canManage && (
        <div className="mt-24">
          <div className="field-grid two">
            <Field
              help="They must already have an account — membership is recorded, no email is sent."
              label="Email"
            >
              <Input
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                value={email}
              />
            </Field>
            <Field
              help="Owners manage the store; operators run it; viewers read only."
              label="Role"
            >
              <Select onChange={(event) => setRole(event.target.value as StoreRole)} value={role}>
                {ROLE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="form-actions">
            <Button
              disabled={email.trim() === ''}
              loading={adding}
              loadingLabel="Adding…"
              onClick={() => {
                void handleAdd();
              }}
              type="button"
              variant="primary"
            >
              <Icon name="i-plus" />
              Add member
            </Button>
          </div>
        </div>
      )}
      <div aria-live="polite" className="small muted mt-24">
        {notice?.text ?? ''}
      </div>
    </section>
  );
}

/**
 * Account section — ported from .template/settings.html (#account): identity,
 * access facts, and the sign-out control that section exists for. Email and
 * role are read from the live session; there is no editable name because the
 * account model has none (never fabricate a field the backend cannot honor).
 */
function AccountSection() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignOut() {
    setSigningOut(true);
    setError(null);
    try {
      await logout();
      // Signed out for real (server cleared the cookie): the honest
      // destination is the public landing page.
      navigate('/');
    } catch (caught) {
      // The server could not confirm the sign-out, so nothing was cleared.
      // ALWAYS state the consequence first; append the server detail for
      // diagnosis. Network-layer failures can carry an EMPTY message — never
      // a silent no-op, and raw status text alone never tells the user
      // whether they are still signed in.
      const detail = caught instanceof Error ? caught.message.trim() : '';
      setError(
        `Sign-out did not happen — you are still signed in.${detail !== '' ? ` (${detail})` : ''}`,
      );
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <section className="panel panel-pad settings-section" id="account">
      <h2>Your account</h2>
      <p className="muted">Identity and access for this session.</p>
      <dl className="facts numeric">
        <div>
          <dt>Email</dt>
          <dd>{user?.email ?? 'Unknown'}</dd>
        </div>
        <div>
          <dt>Role</dt>
          <dd>{user?.role === 'owner' ? 'Store owner' : (user?.role ?? 'Unknown')}</dd>
        </div>
        <div>
          <dt>Password</dt>
          <dd>Managed by your authentication layer</dd>
        </div>
      </dl>
      <div className="row wrap mt-24">
        <Button
          loading={signingOut}
          loadingLabel="Signing out…"
          onClick={() => {
            void handleSignOut();
          }}
          type="button"
        >
          <Icon name="i-logout" />
          Sign out
        </Button>
      </div>
      {/* aria-live kept; no role: RegionForm's save status owns role="status"
          on this page, and getByRole must stay unambiguous. */}
      <div aria-live="polite" className="mt-24">
        {error != null && <InlineNote tone="bad">{error}</InlineNote>}
      </div>
    </section>
  );
}
