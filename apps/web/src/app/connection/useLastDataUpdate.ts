import { useQueryClient, type QueryCache } from '@tanstack/react-query';
import { useCallback, useSyncExternalStore } from 'react';

function latestUpdate(cache: QueryCache): number {
  let latest = 0;
  for (const query of cache.getAll()) latest = Math.max(latest, query.state.dataUpdatedAt);
  return latest;
}

/** Instante (ms) del dato más reciente recibido por cualquier consulta, o null si aún no hay datos. */
export function useLastDataUpdate(): number | null {
  const cache = useQueryClient().getQueryCache();
  const subscribe = useCallback((onChange: () => void) => cache.subscribe(() => onChange()), [cache]);
  const latest = useSyncExternalStore(subscribe, () => latestUpdate(cache));
  return latest === 0 ? null : latest;
}
