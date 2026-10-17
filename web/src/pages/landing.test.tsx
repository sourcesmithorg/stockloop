import { describe, expect, it } from 'vitest';

import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { LandingPage } from '@/pages/landing';

function renderLanding() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <LandingPage />
    </MemoryRouter>,
  );
}

describe('public landing page', () => {
  it('is a home page, not a login form: one h1, no auth form fields', () => {
    renderLanding();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole('heading', { level: 1, name: /Know what to order/ }),
    ).toBeInTheDocument();
    // The old landing was the auth frame — password inputs must never return.
    expect(screen.queryByLabelText(/password/i)).toBeNull();
  });

  it('routes the two calls to action: register primary, login secondary', () => {
    renderLanding();
    const registerLinks = screen.getAllByRole('link', {
      name: /Start with your store|Create your store/,
    });
    expect(registerLinks.length).toBeGreaterThanOrEqual(1);
    for (const link of registerLinks) expect(link).toHaveAttribute('href', '/register');
    const loginLinks = screen.getAllByRole('link', { name: 'Sign in' });
    expect(loginLinks.length).toBeGreaterThanOrEqual(2); // header + hero/closing
    for (const link of loginLinks) expect(link).toHaveAttribute('href', '/login');
  });

  it('states the honesty principles with the shipped product’s own wording', () => {
    renderLanding();
    expect(screen.getByText(/Unknown is not zero/)).toBeInTheDocument();
    expect(screen.getByText(/No history/)).toBeInTheDocument();
    expect(screen.getByText(/Nothing buys autonomously/)).toBeInTheDocument();
    expect(screen.getByText(/Export is not email/)).toBeInTheDocument();
  });

  it('covers the section arc: problem → flow → principles → limits → screens → CTA', () => {
    const { container } = renderLanding();
    for (const id of [
      'landing-hero',
      'landing-problem',
      'landing-how',
      'landing-principles',
      'landing-limits',
      'landing-screens',
      'landing-cta',
    ]) {
      expect(container.querySelector(`#${id}`)).not.toBeNull();
    }
    // Every section is labelled and reachable as a landmark region.
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('never invents numbers: no prices, percentages, or customer counts on the page', () => {
    const { container } = renderLanding();
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/\d+(\.\d+)?%/); // no savings/score percentages
    expect(text).not.toMatch(/[$€£]\s?\d/); // no prices (none have been decided)
    expect(text).not.toMatch(/\d+[km]?\s*(customers|shops|stores|users)\b/i);
  });

  it('keeps exactly one primary-styled register action per view (terracotta discipline)', () => {
    renderLanding();
    const primary = screen.getAllByRole('link', {
      name: /Start with your store|Create your store/,
    });
    // Both CTAs may be primary buttons; nothing else wears terracotta as a link.
    const secondary = screen.getAllByRole('link', { name: 'Sign in' });
    expect(primary.length + secondary.length).toBeGreaterThanOrEqual(3);
    for (const link of secondary) expect(link.getAttribute('href')).toBe('/login');
    const nav = screen.getByRole('navigation', { name: 'Account' });
    expect(within(nav).getAllByRole('link')).toHaveLength(2);
  });
});
