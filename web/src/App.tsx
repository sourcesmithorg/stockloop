import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import {
  AssistantPage,
  ImportMappingPage,
  ImportResultPage,
  ImportValidationPage,
  ImportsPage,
  InventoryPage,
  LandingPage,
  LoginPage,
  OnboardingPage,
  NotFoundPage,
  OrdersPage,
  OrderDetailPage,
  OverviewPage,
  PlanPage,
  ProductPage,
  RegisterPage,
  ReorderPage,
  SettingsPage,
  SupplierPage,
  SuppliersPage,
  WelcomePage,
} from '@/pages';

/**
 * Post-login target: only same-origin absolute paths, never protocol-relative
 * or external URLs.
 */
function safeNext(raw: string | null): string {
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/overview';
}

function LoadingScreen() {
  return (
    <div className="grid min-h-screen place-items-center" role="status">
      <p className="small muted">Loading StockLoop…</p>
    </div>
  );
}

/**
 * Backend unreachable: the session is UNKNOWN, not revoked — the user was not
 * signed out and must not be told so. Honest failure with a retry that
 * re-attempts the session read; nothing is cached or faked.
 */
function UnreachableScreen() {
  const { refresh } = useAuth();
  return (
    <div className="grid min-h-screen place-items-center" role="alert">
      <div className="stack text-center">
        <p>Cannot reach StockLoop right now. You are still signed in.</p>
        <p className="small muted">Your session was not signed out.</p>
        <div>
          <Button
            onClick={() => {
              void refresh().catch(() => undefined);
            }}
            type="button"
            variant="primary"
          >
            Try again
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Route table. Every route renders exactly one <h1> (PageHead) inside the
 * shell's single <main>; unknown paths get the useful not-found state.
 * Login/register/onboarding are standalone full-page layouts outside the shell;
 * the public landing at `/` is standalone too and only ever renders for
 * unauthenticated visitors (the guard sends authenticated `/` into the app).
 */
function AppRoutes() {
  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route path="register" element={<RegisterPage />} />
      <Route path="/" element={<LandingPage />} />
      <Route path="onboarding" element={<OnboardingPage />} />
      <Route element={<AppShell />}>
        <Route path="overview" element={<OverviewPage />} />
        <Route path="assistant" element={<AssistantPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="inventory/:productId" element={<ProductPage />} />
        <Route path="reorder" element={<ReorderPage />} />
        <Route path="plans/:planId" element={<PlanPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="orders/:orderId" element={<OrderDetailPage />} />
        <Route path="suppliers" element={<SuppliersPage />} />
        <Route path="suppliers/:supplierId" element={<SupplierPage />} />
        <Route path="imports" element={<ImportsPage />} />
        <Route path="imports/:importId/mapping" element={<ImportMappingPage />} />
        <Route path="imports/:importId/validation" element={<ImportValidationPage />} />
        <Route path="imports/:importId/result" element={<ImportResultPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="welcome" element={<WelcomePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

/**
 * Auth guard around the route table:
 *  - loading: render a minimal status screen, never redirect;
 *  - unreachable (backend down): render an honest failure with retry — the
 *    session is unknown, never treated as revoked; only public routes render;
 *  - unauthenticated: `/` renders the public landing page, `/login` (or
 *    `/register`) stay put, everything else redirects to /login?next=<path>;
 *  - authenticated without a completed first run: /onboarding (except while
 *    already there);
 *  - authenticated: the app, with `/` landing in the app (/overview) rather
 *    than the public landing, and /onboarding /welcome reachable.
 */
export default function App() {
  const { status, firstRunComplete } = useAuth();
  const location = useLocation();
  const standalone = location.pathname === '/login' || location.pathname === '/register';

  if (status === 'loading') return <LoadingScreen />;

  if (status === 'unreachable') {
    if (standalone || location.pathname === '/') return <AppRoutes />;
    return <UnreachableScreen />;
  }

  if (status === 'authenticated') {
    if (!firstRunComplete && location.pathname !== '/onboarding') {
      return <Navigate to="/onboarding" replace />;
    }
    if (location.pathname === '/') {
      // Authenticated visitors land in the app, never on the public landing.
      return <Navigate to="/overview" replace />;
    }
    if (standalone) {
      const next = new URLSearchParams(location.search).get('next');
      return <Navigate to={safeNext(next)} replace />;
    }
    return <AppRoutes />;
  }

  if (standalone || location.pathname === '/') return <AppRoutes />;
  const next = `${location.pathname}${location.search}`;
  return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
}
