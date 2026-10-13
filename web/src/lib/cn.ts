import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** shadcn/ui-compatible class merger scoped to the Cornerstore theme. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
