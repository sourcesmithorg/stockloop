import { cn } from '@/lib/cn';

/**
 * Icon sprite — ported verbatim from .template/index.html. Symbols are the
 * shared visual vocabulary; add icons there first, never a second set.
 */
export function IconSprite() {
  return (
    <svg
      aria-hidden="true"
      className="sr-only"
      height="0"
      width="0"
      xmlns="http://www.w3.org/2000/svg"
    >
      <symbol id="i-grid" viewBox="0 0 24 24">
        <rect height="7" rx="1.5" width="7" x="3" y="3" />
        <rect height="7" rx="1.5" width="7" x="14" y="3" />
        <rect height="7" rx="1.5" width="7" x="3" y="14" />
        <rect height="7" rx="1.5" width="7" x="14" y="14" />
      </symbol>
      <symbol id="i-box" viewBox="0 0 24 24">
        <path d="m12 3 9 5v8l-9 5-9-5V8zM3 8l9 5 9-5M12 13v8M7 5.8l9 5" />
      </symbol>
      <symbol id="i-spark" viewBox="0 0 24 24">
        <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5zM20 3v4M18 5h4" />
      </symbol>
      <symbol id="i-file" viewBox="0 0 24 24">
        <path d="M14 3H5v18h14V8zM14 3v5h5M8 12h8M8 16h6" />
      </symbol>
      <symbol id="i-truck" viewBox="0 0 24 24">
        <path d="M3 5h11v12H3zM14 9h4l3 4v4h-7" />
        <circle cx="7" cy="18" r="2" />
        <circle cx="18" cy="18" r="2" />
      </symbol>
      <symbol id="i-upload" viewBox="0 0 24 24">
        <path d="M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6" />
      </symbol>
      <symbol id="i-settings" viewBox="0 0 24 24">
        <path d="m10 3-1 3-3 1-3 3 1 3-1 3 3 3 3 1 1 3h4l1-3 3-1 3-3-1-3 1-3-3-3-3-1-1-3z" />
        <circle cx="12" cy="13" r="3" />
      </symbol>
      <symbol id="i-chevron" viewBox="0 0 24 24">
        <path d="m8 10 4 4 4-4" />
      </symbol>
      <symbol id="i-right" viewBox="0 0 24 24">
        <path d="M4 12h16m-6-6 6 6-6 6" />
      </symbol>
      <symbol id="i-left" viewBox="0 0 24 24">
        <path d="M20 12H4m6-6-6 6 6 6" />
      </symbol>
      <symbol id="i-search" viewBox="0 0 24 24">
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </symbol>
      <symbol id="i-bell" viewBox="0 0 24 24">
        <path d="M18 8a6 6 0 0 0-12 0c0 8-3 8-3 10h18c0-2-3-2-3-10M10 21h4" />
      </symbol>
      <symbol id="i-plus" viewBox="0 0 24 24">
        <path d="M12 5v14M5 12h14" />
      </symbol>
      <symbol id="i-minus" viewBox="0 0 24 24">
        <path d="M5 12h14" />
      </symbol>
      <symbol id="i-check" viewBox="0 0 24 24">
        <path d="m5 12 4 4L19 6" />
      </symbol>
      <symbol id="i-check-circle" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 3 3 5-6" />
      </symbol>
      <symbol id="i-info" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 10v7M12 6h.01" />
      </symbol>
      <symbol id="i-warn" viewBox="0 0 24 24">
        <path d="m12 3 10 18H2zM12 9v5M12 17h.01" />
      </symbol>
      <symbol id="i-clock" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </symbol>
      <symbol id="i-globe" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c-5 5-5 13 0 18 5-5 5-13 0-18" />
      </symbol>
      <symbol id="i-filter" viewBox="0 0 24 24">
        <path d="M4 7h16M7 12h10M10 17h4" />
      </symbol>
      <symbol id="i-download" viewBox="0 0 24 24">
        <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
      </symbol>
      <symbol id="i-refresh" viewBox="0 0 24 24">
        <path d="M20 7V3m0 4h-4M4 17v4m0-4h4M20 7a9 9 0 0 0-16 2M4 17a9 9 0 0 0 16-2" />
      </symbol>
      <symbol id="i-mail" viewBox="0 0 24 24">
        <rect height="14" rx="2" width="18" x="3" y="5" />
        <path d="m3 6 9 7 9-7" />
      </symbol>
      <symbol id="i-store" viewBox="0 0 24 24">
        <path d="M3 9 5 3h14l2 6M4 10v11h16V10M8 21v-7h5v7" />
        <path d="M3 9c0 4 6 4 6 0 0 4 6 4 6 0 0 4 6 4 6 0M9 3v6M15 3v6" />
      </symbol>
      <symbol id="i-menu" viewBox="0 0 24 24">
        <path d="M4 6h16M4 12h16M4 18h16" />
      </symbol>
      <symbol id="i-help" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" />
        <path d="M9 8a3 3 0 0 1 6 1c0 2-3 2-3 5M12 18h.01" />
      </symbol>
      <symbol id="i-logout" viewBox="0 0 24 24">
        <path d="M9 3H3v18h6M8 12h13m-5-5 5 5-5 5" />
      </symbol>
      <symbol id="i-layers" viewBox="0 0 24 24">
        <path d="m12 3 10 6-10 6L2 9zM2 14l10 6 10-6" />
      </symbol>
      <symbol id="i-lock" viewBox="0 0 24 24">
        <rect height="11" rx="2" width="16" x="4" y="10" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
      </symbol>
      <symbol id="i-edit" viewBox="0 0 24 24">
        <path d="m16 3 5 5-12 12-6 1 1-6zM13 6l5 5" />
      </symbol>
      <symbol id="i-arrow-up" viewBox="0 0 24 24">
        <path d="M12 19V5m-6 6 6-6 6 6" />
      </symbol>
      <symbol id="i-external" viewBox="0 0 24 24">
        <path d="M14 3h7v7m0-7L10 14M10 3H3v18h18v-7" />
      </symbol>
      <symbol id="i-close" viewBox="0 0 24 24">
        <path d="m6 6 12 12M18 6 6 18" />
      </symbol>
      <symbol id="i-print" viewBox="0 0 24 24">
        <path d="M6 8V3h12v5M6 17H3V8h18v9h-3M6 13h12v8H6zM17 10h.01" />
      </symbol>
      <symbol id="i-shield" viewBox="0 0 24 24">
        <path d="m12 3 8 3v6c0 5-8 9-8 9S4 17 4 12V6zM8 12l3 3 5-6" />
      </symbol>
      <symbol id="i-wallet" viewBox="0 0 24 24">
        <path d="M21 7H3V4h15v3M3 7v14h18V7M21 11h-7v6h7M17 14h.01" />
      </symbol>
      <symbol id="i-chart" viewBox="0 0 24 24">
        <path d="M4 3v18h17M8 16v-4M13 16V7M18 16v-6" />
      </symbol>
      <symbol id="i-pause" viewBox="0 0 24 24">
        <path d="M8 5v14M16 5v14" />
      </symbol>
      <symbol id="i-trash" viewBox="0 0 24 24">
        <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" />
      </symbol>
    </svg>
  );
}

/** Decorative icon beside text; `aria-hidden` because the text carries meaning. */
export function Icon({ name, className }: { name: string; className?: string }) {
  return (
    <svg aria-hidden="true" className={cn('icon', className)}>
      <use href={`#${name}`} />
    </svg>
  );
}
