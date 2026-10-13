import { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { Icon } from '@/components/layout/icon';
import { cn } from '@/lib/cn';

export type ToastTone = 'good' | 'bad' | 'info' | 'warn';

export interface ToastInput {
  tone: ToastTone;
  title: string;
  description?: string;
}

interface ToastItem extends ToastInput {
  id: number;
}

interface ToastContextValue {
  push: (toast: ToastInput) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used inside <ToastProvider>');
  }
  return context;
}

const TONE_ICONS: Record<ToastTone, string> = {
  good: 'i-check-circle',
  bad: 'i-warn',
  info: 'i-info',
  warn: 'i-warn',
};

/**
 * Toast feedback: polite status announcements (assertive for failures).
 * Dismissal is manual — no timers, so reduced-motion users are never robbed of
 * the message and announcements stay deterministic.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const push = useCallback((toast: ToastInput) => {
    nextId.current += 1;
    setToasts((current) => [...current, { ...toast, id: nextId.current }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ push, dismiss }}>
      {children}
      <div
        aria-label="Notifications"
        className="fixed bottom-6 right-6 z-40 flex w-[min(520px,calc(100vw-3rem))] flex-col gap-3"
        role="region"
      >
        {toasts.map((toast) => (
          <div
            className={cn('toast-sample', toast.tone === 'bad' && 'border-danger')}
            key={toast.id}
            role={toast.tone === 'bad' ? 'alert' : 'status'}
          >
            <Icon name={TONE_ICONS[toast.tone]} />
            <div className="grow">
              <strong>{toast.title}</strong>
              {toast.description && <p>{toast.description}</p>}
            </div>
            <button className="text-link" onClick={() => dismiss(toast.id)} type="button">
              Dismiss<span className="sr-only"> notification</span>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
