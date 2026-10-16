import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { AppShell } from '@/components/layout/app-shell';
import { useAuth } from '@/lib/auth';
import {
  ImportMappingPage,
  ImportResultPage,
  ImportValidationPage,
  ImportsPage,
  InventoryPage,
  LandingPage,
  LoginPage,
  NotFoundPage,
  OnboardingPage,
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
