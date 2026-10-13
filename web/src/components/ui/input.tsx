import { forwardRef } from 'react';
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

import { useFieldControl } from './field';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

/**
 * `.control` styling (cornerstore.css) — also applies inside `.field`, which
 * styles the same geometry for its inputs. Inherits Field wiring when nested.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, id, invalid, ...rest },
  ref,
) {
  const control = useFieldControl({ id, invalid, describedBy: rest['aria-describedby'] });
  return (
    <input
      ref={ref}
      {...control}
      {...rest}
      className={cn('control', className)}
      data-slot="input"
    />
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, id, invalid, children, ...rest },
  ref,
) {
  const control = useFieldControl({ id, invalid, describedBy: rest['aria-describedby'] });
  return (
    <select
      ref={ref}
      {...control}
      {...rest}
      className={cn('control', className)}
      data-slot="select"
    >
      {children}
    </select>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, id, invalid, ...rest },
  ref,
) {
  const control = useFieldControl({ id, invalid, describedBy: rest['aria-describedby'] });
  return (
    <textarea
      ref={ref}
      {...control}
      {...rest}
      className={cn('control', className)}
      data-slot="textarea"
    />
  );
});
