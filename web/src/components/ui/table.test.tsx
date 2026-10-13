import { describe, expect, it } from 'vitest';

import { render, screen } from '@testing-library/react';

import { Table } from './table';

describe('Table', () => {
  it('renders a labeled, keyboard-focusable scroll region', () => {
    render(
      <Table caption="Products at risk this week" label="At-risk products">
        <thead>
          <tr>
            <th scope="col">Product</th>
            <th scope="col">Cover</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Oat milk</th>
            <td>3 days</td>
          </tr>
        </tbody>
      </Table>,
    );

    const region = screen.getByRole('region', { name: 'At-risk products' });
    expect(region).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('table', { name: 'Products at risk this week' })).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader')).toHaveLength(2);
    expect(screen.getByRole('rowheader', { name: 'Oat milk' })).toBeInTheDocument();
  });

  it('can hide the caption visually while keeping it for assistive tech', () => {
    render(
      <Table caption="Supplier subtotals" captionVisible={false} label="Subtotals">
        <tbody>
          <tr>
            <td>Freshfield Foods</td>
          </tr>
        </tbody>
      </Table>,
    );
    expect(screen.getByRole('table', { name: 'Supplier subtotals' })).toBeInTheDocument();
    expect(document.querySelector('caption')).toHaveClass('sr-only');
  });
});
