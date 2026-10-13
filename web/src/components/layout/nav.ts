export interface NavItem {
  to: string;
  label: string;
  icon: string;
  /** Exact match only (no child routes under this section). */
  end?: boolean;
}

/** Navigation order is fixed by .docs/UI-UX-GUIDE.md: settings stays secondary. */
export const PRIMARY_NAV: NavItem[] = [
  { to: '/overview', label: 'Overview', icon: 'i-grid', end: true },
  { to: '/inventory', label: 'Inventory', icon: 'i-box' },
  { to: '/reorder', label: 'Reorder studio', icon: 'i-spark' },
  { to: '/orders', label: 'Purchase orders', icon: 'i-file' },
  { to: '/suppliers', label: 'Suppliers', icon: 'i-truck' },
  { to: '/imports', label: 'Data imports', icon: 'i-upload' },
];

export const SECONDARY_NAV: NavItem[] = [
  { to: '/settings', label: 'Settings', icon: 'i-settings', end: true },
];

/** Section label for the header breadcrumb, derived from the first path segment. */
export function sectionLabel(pathname: string): string {
  const [segment] = pathname.split('/').filter(Boolean);
  const match = [...PRIMARY_NAV, ...SECONDARY_NAV].find((item) => item.to === `/${segment}`);
  return match ? match.label : 'Overview';
}
