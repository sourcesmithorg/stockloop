import { Navigate, Route, Routes } from 'react-router-dom';

import { AppShell } from '@/components/layout/app-shell';
import {
  ImportMappingPage,
  ImportResultPage,
  ImportValidationPage,
  ImportsPage,
  InventoryPage,
  NotFoundPage,
  OrdersPage,
  OrderDetailPage,
  OverviewPage,
  PlanPage,
  ProductPage,
  ReorderPage,
  SettingsPage,
  SupplierPage,
  SuppliersPage,
  WelcomePage,
} from '@/pages';

/**
 * Route table. Every route renders exactly one <h1> (PageHead) inside the
 * shell's single <main>; unknown paths get the useful not-found state.
 */
export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate replace to="/overview" />} />
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
