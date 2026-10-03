import type { Reading } from '@gd/api';
import { MAX_READINGS_PER_RANGE, dailyChunks, rangeWindow, type RangeKey, type TimeWindow } from '@gd/domain';
import { useQueries } from '@tanstack/react-query';
import { useMemo, useRef } from 'react';
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
      staleTime: chunk.closed ? Number.POSITIVE_INFINITY : OPEN_CHUNK_STALE_MS,
      refetchInterval: chunk.closed ? (false as const) : POLL_INTERVALS_MS.sensors,
    })),
  });

  // Identidad estable de `readings` mientras ningún tramo cambie (evita recalcular series y reenviar al Worker).
  const resultsRef = useRef(results);
  resultsRef.current = results;
  const version = results.map((r) => `${r.dataUpdatedAt}:${r.data ? 1 : 0}`).join('|');
  const readings = useMemo(() => {
    const merged = resultsRef.current.flatMap((r) => r.data ?? []);
    return merged.length === 0 ? EMPTY : merged;
    // `version` resume los datos de los tramos (la dependencia real); `results` cambia de identidad en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

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
