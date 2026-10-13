import { describe, expect, it } from 'vitest';

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import App from '@/App';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('routing and shell invariants', () => {
  it('renders /overview with exactly one h1 and one main landmark', () => {
    renderAt('/overview');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('A little foresight.');
  });

  it('puts the skip link first in the document', () => {
    renderAt('/inventory');
    const links = document.querySelectorAll('a');
    expect(links[0]).toHaveClass('skip-link');
    expect(links[0]).toHaveAttribute('href', '#main-content');
  });

  it('marks the active sidebar destination with aria-current', () => {
    renderAt('/suppliers');
    // Sidebar and mobile nav both render this link; both must be current.
    const links = screen.getAllByRole('link', { name: 'Suppliers' });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link).toHaveAttribute('aria-current', 'page');
    }
  });

  it('renders detail routes with the record id in the h1', () => {
    renderAt('/plans/PLAN-001');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Restock plan · PLAN-001');
  });

  it('shows a useful not-found state for unknown paths', () => {
    renderAt('/this/path/does-not-exist');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'We couldn’t find that record.',
    );
    expect(screen.getByRole('link', { name: /Back to overview/ })).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('still renders exactly one h1 on the not-found route', () => {
    renderAt('/gone');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });
});
