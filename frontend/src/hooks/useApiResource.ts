// One hook that every page uses to load data, so loading / empty / error states
// behave identically across the whole app (no duplicated fetch logic).

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, IS_DEMO_MODE } from '../services/api';

export interface ResourceState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** True when the request succeeded but returned nothing to show. */
  isEmpty: boolean;
  reload: () => void;
}

/**
 * @param loader   real backend call, used when demo mode is off
 * @param demoData sample data used when demo mode is on (VITE_USE_DEMO_DATA)
 * @param isEmpty  decides when a non-null result should count as "empty"
 */
export function useApiResource<T>(
  loader: () => Promise<T>,
  demoData: T,
  isEmpty?: (value: T) => boolean,
): ResourceState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const run = async (): Promise<void> => {
      try {
        if (IS_DEMO_MODE) {
          // Short delay so the loading state is a real, visible code path
          // instead of dead code. No network request is made in demo mode.
          await new Promise((resolve) => window.setTimeout(resolve, 250));
          if (!cancelled && mounted.current) setData(demoData);
          return;
        }
        const result = await loader();
        if (!cancelled && mounted.current) setData(result);
      } catch (caught) {
        if (cancelled || !mounted.current) return;
        if (caught instanceof ApiError) setError(caught.message);
        else setError(caught instanceof Error ? caught.message : 'Unexpected error');
      } finally {
        if (!cancelled && mounted.current) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  return {
    data,
    loading,
    error,
    isEmpty: !loading && !error && data !== null && (isEmpty?.(data) ?? false),
    reload,
  };
}
