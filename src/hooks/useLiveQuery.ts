import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';

import { subscribeToChanges, type TableName } from '@/db/changes';

export interface LiveQuery<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | null;
  reload: () => void;
}

/**
 * Runs `fetcher` and re-runs it whenever one of `tables` changes or a
 * dependency changes. Stale responses from superseded runs are discarded,
 * and nothing is set after unmount.
 */
export function useLiveQuery<T>(fetcher: () => Promise<T>, tables: readonly TableName[], deps: DependencyList): LiveQuery<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const runId = useRef(0);
  const fetcherRef = useRef(fetcher);
  // Keep the latest fetcher without re-subscribing; declared before the run
  // effect so it is updated first.
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const run = useCallback(() => {
    const id = ++runId.current;
    fetcherRef
      .current()
      .then((result) => {
        if (id !== runId.current) return;
        setData(result);
        setError(null);
        setLoading(false);
      })
      .catch((caught: unknown) => {
        if (id !== runId.current) return;
        console.error('Query failed', caught);
        setError(caught instanceof Error ? caught : new Error(String(caught)));
        setLoading(false);
      });
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(run, deps);

  const tableKey = tables.join('|');
  useEffect(() => {
    const watched = new Set(tableKey.split('|'));
    const unsubscribe = subscribeToChanges((changed) => {
      for (const table of changed) {
        if (watched.has(table)) {
          run();
          return;
        }
      }
    });
    return () => {
      unsubscribe();
      runId.current += 1;
    };
  }, [tableKey, run]);

  return { data, loading, error, reload: run };
}
