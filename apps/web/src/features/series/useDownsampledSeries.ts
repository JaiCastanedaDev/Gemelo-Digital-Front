import { TARGET_POINTS, downsampleSeries, type DownsampleStrategy, type SeriesMap } from '@gd/domain';
import { useEffect, useMemo, useState } from 'react';
import { handleDownsample, type DownsampleRequest, type DownsampleResponse } from './downsampleTask';

type Pending = { request: DownsampleRequest; resolve: (series: SeriesMap) => void };

const EMPTY: SeriesMap = {};

let worker: Worker | null = null;
let workerBroken = false;
let nextId = 1;
const pending = new Map<number, Pending>();

function workerAvailable(): boolean {
  return typeof Worker !== 'undefined' && !workerBroken;
}

// Marca el Worker como inutilizable y resuelve cada petición pendiente en el hilo principal.
function failOver(): void {
  workerBroken = true;
  worker?.terminate();
  worker = null;
  for (const [id, entry] of [...pending]) {
    pending.delete(id);
    entry.resolve(handleDownsample(entry.request).series);
  }
}

function getWorker(): Worker {
  if (worker) return worker;
  const created = new Worker(new URL('./downsample.worker.ts', import.meta.url), { type: 'module' });
  created.onmessage = (event: MessageEvent<DownsampleResponse>) => {
    const entry = pending.get(event.data.id);
    if (!entry) return;
    pending.delete(event.data.id);
    entry.resolve(event.data.series);
  };
  created.onerror = () => {
    if (worker === created) failOver();
  };
  worker = created;
  return created;
}

export function __resetDownsampleWorkerForTests(): void {
  worker?.terminate();
  worker = null;
  workerBroken = false;
  nextId = 1;
  pending.clear();
}

export function useDownsampledSeries(
  series: SeriesMap,
  strategy: DownsampleStrategy,
  target: number = TARGET_POINTS,
  /** Identifica el origen de la serie (sensor+rango): una salida previa solo se conserva con la misma clave. */
  resetKey = '',
): { series: SeriesMap; pending: boolean; refreshing?: boolean } {
  const needs = Object.values(series).some((points) => points.length > target);
  const useWorker = needs && workerAvailable();
  const syncResult = useMemo(
    () => (needs && !useWorker ? downsampleSeries(series, strategy, target) : null),
    [needs, useWorker, series, strategy, target],
  );
  const [result, setResult] = useState<{ input: SeriesMap; output: SeriesMap; key: string; strategy: DownsampleStrategy } | null>(null);

  useEffect(() => {
    if (!useWorker) return;
    let cancelled = false;
    const request: DownsampleRequest = { id: nextId++, series, strategy, target };
    pending.set(request.id, {
      request,
      resolve: (output) => {
        if (!cancelled) setResult({ input: series, output, key: resetKey, strategy });
      },
    });
    try {
      getWorker().postMessage(request);
    } catch {
      // Worker no disponible (CSP, entorno sin soporte): reducción síncrona.
      failOver();
    }
    return () => {
      cancelled = true;
      pending.delete(request.id);
    };
    }, [useWorker, series, strategy, target, resetKey]);

  if (!needs) return { series, pending: false };
  if (syncResult) return { series: syncResult, pending: false };
  if (result && result.input === series) return { series: result.output, pending: false };
  // Mientras llega la nueva reducción se conserva la anterior de la misma serie para no vaciar la gráfica.
  if (result && result.key === resetKey && result.strategy === strategy) {
    return { series: result.output, pending: false, refreshing: true };
  }
  return { series: EMPTY, pending: true };
}
