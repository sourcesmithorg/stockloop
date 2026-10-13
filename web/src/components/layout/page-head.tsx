import type { ReactNode } from 'react';

/**
 * Canonical page heading: `.eyebrow` + single `<h1>` + description +
 * `.page-head-actions`. Exactly one PageHead (and one h1) per route; the h1 is
 * the deliberate focus target after client-side navigation (tabIndex -1).
 */
export function PageHead({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-head" data-component="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 tabIndex={-1}>{title}</h1>
        {description && <p className="description">{description}</p>}
      </div>
      {actions && <div className="page-head-actions">{actions}</div>}
    </div>
  );
}
