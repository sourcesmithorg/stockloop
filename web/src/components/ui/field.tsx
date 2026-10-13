import { createContext, useContext, useId } from 'react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

interface FieldContextValue {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

export interface FieldControlOverrides {
  id?: string;
  describedBy?: string;
  invalid?: boolean;
}

/**
 * Controls (Input, Select, QuantityInput) called inside a Field inherit its
 * id, aria-describedby wiring and aria-invalid — the a11y contract from
 * .docs/UI-UX-GUIDE.md: labels tied to help and error text.
 */
export function useFieldControl(overrides: FieldControlOverrides = {}) {
  const context = useContext(FieldContext);
  return {
    id: overrides.id ?? context?.id,
    'aria-describedby': overrides.describedBy ?? context?.describedBy,
    'aria-invalid': overrides.invalid ?? (context?.invalid || undefined),
  };
}

export interface FieldProps {
  label: string;
  /** Visible help and error text; error also flips aria-invalid on controls. */
  help?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  id?: string;
  className?: string;
  children: ReactNode;
}

export function Field({
  label,
  help,
  error,
  required = false,
  id,
  className,
  children,
}: FieldProps) {
  const autoId = useId().replace(/:/g, '');
  const fieldId = id ?? `field-${autoId}`;
  const helpId = help ? `${fieldId}-help` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [errorId, helpId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('field', className)}>
      <label htmlFor={fieldId}>
        {label}
        {required && (
          <>
            {' '}
            <span aria-hidden="true">*</span>
          </>
        )}
      </label>
      <FieldContext.Provider value={{ id: fieldId, describedBy, invalid: Boolean(error) }}>
        {children}
      </FieldContext.Provider>
      {help && (
        <small id={helpId} className="block text-xs text-muted">
          {help}
        </small>
      )}
      {error && (
        <small className="field-error" id={errorId}>
          {error}
        </small>
      )}
    </div>
  );
}
