import { describe, expect, it } from 'vitest';

import { render, screen } from '@testing-library/react';

import { Field } from './field';
import { Input, Select } from './input';
import { QuantityInput } from './quantity-input';

describe('Field', () => {
  it('associates label, help and error with the control', () => {
    render(
      <Field error="Must be a whole number" help="Base units per purchase pack." label="Quantity">
        <Input />
      </Field>,
    );

    const input = screen.getByLabelText(/Quantity/);
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();

    const [errorId, helpId] = describedBy!.split(' ');
    expect(document.getElementById(errorId)).toHaveTextContent('Must be a whole number');
    expect(document.getElementById(helpId)).toHaveTextContent('Base units per purchase pack.');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('wires help text without an error as non-invalid', () => {
    render(
      <Field help="Delivery days the supplier accepts." label="Supplier">
        <Select defaultValue="SUP-001">
          <option value="SUP-001">Freshfield Foods</option>
        </Select>
      </Field>,
    );

    const select = screen.getByLabelText(/Supplier/);
    expect(select).not.toHaveAttribute('aria-invalid');
    const helpId = select.getAttribute('aria-describedby')!;
    expect(document.getElementById(helpId)).toHaveTextContent('Delivery days');
  });

  it('keeps caller-supplied ids and describedby intact', () => {
    render(
      <Field help="Stable id for tests." id="stock-count" label="On hand">
        <Input aria-describedby="external-note" />
      </Field>,
    );
    const input = screen.getByLabelText(/On hand/);
    expect(input).toHaveAttribute('id', 'stock-count');
    expect(input).toHaveAttribute('aria-describedby', 'external-note');
  });
});

describe('QuantityInput', () => {
  it('exposes accessible step buttons and numeric entry', () => {
    const values: (number | null)[] = [];
    render(
      <Field label="Order quantity">
        <QuantityInput
          label="Order quantity"
          onValueChange={(next) => values.push(next)}
          value={24}
        />
      </Field>,
    );

    const input = screen.getByLabelText('Order quantity');
    expect(input).toHaveAttribute('type', 'number');
    expect(input).toHaveValue(24);

    screen.getByRole('button', { name: 'Increase Order quantity' }).click();
    screen.getByRole('button', { name: 'Decrease Order quantity' }).click();
    expect(values).toEqual([25, 23]);
  });

  it('distinguishes no value from a verified zero', () => {
    const values: (number | null)[] = [];
    render(
      <QuantityInput
        label="Edited units"
        onValueChange={(next) => values.push(next)}
        value={null}
      />,
    );
    const input = screen.getByLabelText('Edited units');
    expect(input).toHaveValue(null);
  });
});
