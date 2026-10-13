import { useId } from 'react';
import type { ChangeEvent } from 'react';

import { cn } from '@/lib/cn';

import { useFieldControl } from './field';

export interface QuantityInputProps {
  /** null = no value entered (distinct from a verified 0). */
  value: number | null;
  onValueChange: (value: number | null) => void;
  /** Accessible name; matches the visible Field label when nested. */
  label: string;
  id?: string;
  min?: number;
  max?: number;
  step?: number;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * Base-unit quantity control: numeric entry plus step buttons (44px targets).
 * Validation of pack multiples / MOQ belongs to the caller — this only keeps
 * input valid integers and clamps to min/max when provided.
 */
export function QuantityInput({
  value,
  onValueChange,
  label,
  id,
  min,
  max,
  step = 1,
  invalid,
  disabled,
  className,
}: QuantityInputProps) {
  const autoId = useId().replace(/:/g, '');
  const control = useFieldControl({ id, invalid });
  const fieldId = control.id ?? `qty-${autoId}`;

  const clamp = (next: number) => {
    let result = next;
    if (min !== undefined) result = Math.max(min, result);
    if (max !== undefined) result = Math.min(max, result);
    return result;
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    if (raw.trim() === '') {
      onValueChange(null);
      return;
    }
    const parsed = Number(raw);
    onValueChange(Number.isNaN(parsed) ? null : parsed);
  };

  const buttonClasses = cn(
    'h-10 w-10 shrink-0 rounded-sm border border-control bg-surface text-ink',
    'hover:bg-soft disabled:cursor-not-allowed disabled:bg-soft disabled:text-muted',
    'focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-primary focus-visible:outline-offset-[3px]',
  );

  return (
    <div className={cn('flex items-center gap-2', className)} data-slot="quantity-input">
      <button
        aria-label={`Decrease ${label}`}
        className={buttonClasses}
        disabled={disabled}
        onClick={() => onValueChange(clamp((value ?? 0) - step))}
        type="button"
      >
        −
      </button>
      <input
        aria-label={label}
        aria-describedby={control['aria-describedby']}
        aria-invalid={control['aria-invalid']}
        className="qty"
        disabled={disabled}
        id={fieldId}
        inputMode="numeric"
        max={max}
        min={min}
        onChange={handleChange}
        step={step}
        type="number"
        value={value ?? ''}
      />
      <button
        aria-label={`Increase ${label}`}
        className={buttonClasses}
        disabled={disabled}
        onClick={() => onValueChange(clamp((value ?? 0) + step))}
        type="button"
      >
        +
      </button>
    </div>
  );
}
