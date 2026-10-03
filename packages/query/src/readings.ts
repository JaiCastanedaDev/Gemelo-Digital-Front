import type { Reading } from '@gd/api';
import { MAX_READINGS_PER_RANGE, dailyChunks, rangeWindow, type RangeKey, type TimeWindow } from '@gd/domain';
import { useQueries } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import { useApi } from './ApiContext';
import { POLL_INTERVALS_MS } from './intervals';
import { queryKeys } from './keys';

export interface SensorReadings {
  readings: Reading[];
  window: TimeWindow;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  dataUpdatedAt: number;
  tooMany: boolean;
  refetch: () => void;
}

const EMPTY: Reading[] = [];
const OPEN_CHUNK_STALE_MS = 30_000;

/** Lecturas por tramos diarios: los días cerrados se cachean para siempre y el día en curso se refresca. */
export function useSensorReadings(sensorId: string | null, range: RangeKey): SensorReadings {
  const api = useApi();
  // La ventana se fija por minuto: es estable entre renders y sirve como dependencia de memos en los consumidores.
  const minute = Math.floor(Date.now() / 60_000);
  const { window, chunks } = useMemo(() => {
    const now = Date.now();
    const w = rangeWindow(range, now);
    return { window: w, chunks: sensorId ? dailyChunks(w, now) : [] };
    // `minute` invalida la ventana al cambiar el minuto; `now` se lee dentro a propósito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sensorId, range, minute]);

  const results = useQueries({
    queries: chunks.map((chunk) => ({
      queryKey: queryKeys.readings.chunk(sensorId ?? '', chunk.desde, chunk.hasta),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        api.sensors.readings(sensorId ?? '', { desde: chunk.desde, hasta: chunk.hasta }, signal),
      // Un tramo que se cerró (medianoche UTC) con datos anteriores a su `hasta` se vuelve a pedir una vez para completar su cola.
      staleTime: chunk.closed
        ? (query: { state: { dataUpdatedAt: number } }) =>
            query.state.dataUpdatedAt >= Date.parse(chunk.hasta) ? Number.POSITIVE_INFINITY : 0
        : OPEN_CHUNK_STALE_MS,
      refetchInterval: chunk.closed ? (false as const) : POLL_INTERVALS_MS.sensors,
    })),
  });

  // Cambiar `staleTime` no relanza un tramo ya montado: al cerrarse (medianoche UTC) con datos anteriores a su `hasta`,
  // se refresca una sola vez por tramo para recuperar la cola del día.
  const closedRefetched = useRef(new Set<string>());
  useEffect(() => {
    chunks.forEach((chunk, i) => {
      const r = results[i];
      if (!chunk.closed || !r || r.data === undefined || r.isFetching) return;
      if (r.dataUpdatedAt >= Date.parse(chunk.hasta)) return;
      const id = `${sensorId ?? ''}|${chunk.desde}`;
      if (closedRefetched.current.has(id)) return;
      closedRefetched.current.add(id);
      void r.refetch();
    });
  });

  // Identidad estable de `readings`: solo cambia cuando cambia la referencia de los datos de algún tramo
  // (el structural sharing de TanStack conserva `data` si un refetch devuelve lo mismo, aunque suba dataUpdatedAt).
  const resultsRef = useRef(results);
  resultsRef.current = results;
  const prevRef = useRef<{ datas: (Reading[] | undefined)[]; merged: Reading[] } | null>(null);
  const datas = results.map((r) => r.data);
  const prev = prevRef.current;
  let readings: Reading[];
  if (prev && prev.datas.length === datas.length && prev.datas.every((d, i) => d === datas[i])) {
    readings = prev.merged;
  } else {
    const merged = datas.flatMap((d) => d ?? []);
    readings = merged.length === 0 ? EMPTY : merged;
    prevRef.current = { datas, merged: readings };
  }

  return {
    readings,
    window,
    isPending: results.some((r) => r.isPending),
    isError: results.some((r) => r.isError && r.data === undefined),
    error: results.find((r) => r.isError)?.error ?? null,
    dataUpdatedAt: results.reduce((latest, r) => Math.max(latest, r.dataUpdatedAt), 0),
    tooMany: readings.length > MAX_READINGS_PER_RANGE,
    refetch: () => {
      for (const r of resultsRef.current) void r.refetch();
    },
  };
}
