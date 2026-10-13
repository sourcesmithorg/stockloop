import { describe, expect, it } from 'vitest';

import { render, screen } from '@testing-library/react';

import { Button } from './button';

describe('Button', () => {
  it('renders its label and is enabled by default', () => {
    render(<Button>Review draft</Button>);
    const button = screen.getByRole('button', { name: 'Review draft' });
    expect(button).toBeEnabled();
  });

  it('applies the primary token classes', () => {
    render(<Button variant="primary">Approve</Button>);
    expect(screen.getByRole('button', { name: 'Approve' })).toHaveClass(
      'bg-primary',
      'text-surface',
    );
  });

  it('applies the danger variant', () => {
    render(<Button variant="danger">Exclude line</Button>);
    expect(screen.getByRole('button', { name: 'Exclude line' })).toHaveClass(
      'border-danger',
      'text-danger',
    );
  });

  it('keeps a visible focus target', () => {
    render(<Button>Focusable</Button>);
    expect(screen.getByRole('button', { name: 'Focusable' })).toHaveClass(
      'focus-visible:outline-primary',
    );
  });

  it('disables while loading and announces the pending label', () => {
    render(<Button loading>Save</Button>);
    const button = screen.getByRole('button', { name: /Save/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveTextContent('Working…');
  });

  it('honors an explicit disabled state', () => {
    render(<Button disabled>Approve</Button>);
    expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled();
  });
});
