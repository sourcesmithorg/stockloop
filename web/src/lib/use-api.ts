import { useCallback, useEffect, useRef, useState } from 'react';
import type { DependencyList } from 'react';

export interface ApiState<T> {
  data: T | null;
  /** Apply a server response from a mutation without a refetch. */
  setData: (value: T | null) => void;
  error: unknown;
  loading: boolean;
  /** Refetch after a failure (or refresh); screen state around it is kept. */
  reload: () => void;
}
/**
 * Minimal data-fetch state for screens: loading → ready | error, plus a
 * retry that keeps the screen's filters and context intact.
 */
export function useApi<T>(loader: () => Promise<T>, deps: DependencyList): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    loaderRef
      .current()
      .then((result) => {
        if (!alive) return;
        setData(result);
        setLoading(false);
      })
      .catch((caught: unknown) => {
        if (!alive) return;
        setError(caught);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
    // Caller-supplied deps plus the retry counter; loader identity is
    // irrelevant (it is read through a ref).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  return { data, error, loading, reload, setData };
}
