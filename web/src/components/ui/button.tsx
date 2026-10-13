import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

/** Mirrors `.btn` variants from cornerstore.css with Tailwind theme tokens. */
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'border-primary bg-primary text-surface hover:border-primary-hover hover:bg-primary-hover',
  secondary: 'border-border bg-surface text-ink hover:border-control hover:bg-soft',
  ghost: 'border-transparent bg-transparent text-ink hover:bg-soft',
  danger: 'border-danger bg-surface text-danger hover:border-control hover:bg-soft',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  md: 'min-h-[44px] px-4 py-[10px] text-[0.875rem]',
  sm: 'min-h-[40px] px-3 py-2 text-sm',
};

const BASE_CLASSES = [
  'inline-flex items-center justify-center gap-2 rounded-sm border font-semibold leading-[1.4] no-underline',
  'transition-[background-color,border-color,transform] duration-[180ms] ease-loop active:translate-y-px',
  'focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-primary focus-visible:outline-offset-[3px]',
  'disabled:cursor-not-allowed disabled:border-border disabled:bg-soft disabled:text-muted',
].join(' ');

/**
 * One class contract for button-shaped actions: real mutations are <button>,
 * navigation uses <Link className={buttonClass(...)}> (or <ButtonLink>).
 */
export function buttonClass(
  variant: ButtonVariant = 'secondary',
  size: ButtonSize = 'md',
  className?: string,
): string {
  return cn(BASE_CLASSES, VARIANT_CLASSES[variant], SIZE_CLASSES[size], className);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Pending mutation: prevents duplicate submits, keeps an accessible label. */
  loading?: boolean;
  loadingLabel?: string;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  loadingLabel = 'Working…',
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      aria-busy={loading || undefined}
      className={buttonClass(variant, size, className)}
      disabled={disabled || loading}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
      {loading && <span className="sr-only">{loadingLabel}</span>}
    </button>
  );
}

export interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

/** Same visual contract as Button for links (navigation, never mutation). */
export function ButtonLink({
  variant = 'secondary',
  size = 'md',
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <a {...rest} className={buttonClass(variant, size, className)}>
      {children}
    </a>
  );
}
