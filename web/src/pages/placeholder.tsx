import type { ReactNode } from 'react';

import { PageHead } from '@/components/layout/page-head';
import { InlineNote } from '@/components/ui';
import { usePageTitle } from '@/lib/use-page-title';

export interface PlaceholderPageProps {
  /** The route's single <h1> — keep the template's page copy. */
  title: ReactNode;
  /** document.title segment. */
  docTitle: string;
  eyebrow?: string;
  description?: string;
  /** What the finished screen shows and which endpoints feed it. */
  note: string;
  /** Workstream that replaces this body. */
  owner: string;
  actions?: ReactNode;
}

/**
 * Shared scaffold body for every not-yet-implemented route: correct <h1>,
 * page-head contract and an honest note. Downstream agents replace the panel,
 * not the shell.
 */
export function PlaceholderPage({
  title,
  docTitle,
  eyebrow,
  description,
  note,
  owner,
  actions,
}: PlaceholderPageProps) {
  usePageTitle(docTitle);
  return (
    <>
      <PageHead actions={actions} description={description} eyebrow={eyebrow} title={title} />
      <div className="panel panel-pad stack">
        <h2>Not yet implemented</h2>
        <p>{note}</p>
        <p className="small muted">
          Screen owner: {owner}. The app shell, design tokens, routing and shared primitives around
          this placeholder are final — replace this body while keeping one h1 and the page-head
          contract.
        </p>
        <InlineNote title="Fixture data only">
          No live API is connected yet. Screens read the fixture layer in{' '}
          <code className="mono">src/lib/mock</code>; set{' '}
          <code className="mono">VITE_USE_MOCK=false</code> to hit the real backend through the dev
          proxy.
        </InlineNote>
      </div>
    </>
  );
}
