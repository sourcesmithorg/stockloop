import { describe, expect, it } from 'vitest';

import { render, screen } from '@testing-library/react';

import type { RiskState } from '@/lib/api';

import { RiskStatePill, StatusPill } from './status-pill';

describe('StatusPill', () => {
  it('always renders status text — never color alone', () => {
    render(<StatusPill label="Awaiting review" tone="warn" />);
    expect(screen.getByText('Awaiting review')).toBeInTheDocument();
  });

  it('renders its icon as decoration', () => {
    const { container } = render(<StatusPill icon="i-clock" label="Running low" tone="warn" />);
    const icon = container.querySelector('svg.icon');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });

  it('maps every risk state to distinct text', () => {
    const cases: [RiskState, string][] = [
      ['outOfStock', 'Out of stock'],
      ['atRisk', 'At risk'],
      ['runningLow', 'Running low'],
      ['healthy', 'Healthy'],
      ['noRecentSales', 'No recent sales'],
      ['dataNeeded', 'Data needed'],
      ['stale', 'Stale data'],
    ];
    const rendered = cases.map(([state, label]) => {
      render(<RiskStatePill state={state} />);
      return screen.getByText(label).textContent;
    });
    expect(rendered).toHaveLength(7);
    expect(new Set(rendered).size).toBe(7);
  });
});
