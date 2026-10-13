import { useEffect } from 'react';

/** Meaningful document title per route (UI-UX-GUIDE: routed apps need titles). */
export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · StockLoop`;
  }, [title]);
}
