import type { SeriesMap } from '@gd/domain';
import { renderHook, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleDownsample, type DownsampleRequest } from './downsampleTask';
import { __resetDownsampleWorkerForTests, useDownsampledSeries } from './useDownsampledSeries';

function longSeries(n: number): SeriesMap {
  return { x: Array.from({ length: n }, (_, i): [number, number] => [i * 60_000, Math.sin(i / 30)]) };
}

const originalWorker = globalThis.Worker;

afterEach(() => {
  __resetDownsampleWorkerForTests();
  if (originalWorker) globalThis.Worker = originalWorker;
  else Reflect.deleteProperty(globalThis, 'Worker');
});

describe('useDownsampledSeries', () => {
  it('series cortas pasan tal cual', () => {
    const series = longSeries(100);
    const { result } = renderHook(() => useDownsampledSeries(series, 'lttb'));
    expect(result.current).toEqual({ series, pending: false });
  });

  it('sin Worker reduce en el hilo principal', () => {
    Reflect.deleteProperty(globalThis, 'Worker');
    const { result } = renderHook(() => useDownsampledSeries(longSeries(10_000), 'lttb'));
    expect(result.current.pending).toBe(false);
    expect(result.current.series.x).toHaveLength(1500);
  });

  it('con Worker reduce fuera del hilo principal e ignora respuestas obsoletas', async () => {
    const posted: DownsampleRequest[] = [];
    class FakeWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      postMessage(request: DownsampleRequest) {
        posted.push(request);
        queueMicrotask(() => this.onmessage?.({ data: handleDownsample(request) } as MessageEvent));
      }
      terminate() {}
    }
    globalThis.Worker = FakeWorker as unknown as typeof Worker;
    const first = longSeries(10_000);
    const second = longSeries(20_000);
    const { result, rerender } = renderHook(({ s }: { s: SeriesMap }) => useDownsampledSeries(s, 'minmax'), {
      initialProps: { s: first },
    });
    expect(result.current.pending).toBe(true);
    rerender({ s: second });
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(posted).toHaveLength(2);
    expect(result.current.series.x!.length).toBeLessThanOrEqual(1500);
    expect(result.current.series.x!.at(-1)![0]).toBe(19_999 * 60_000);
  });

  it('si el Worker falla vuelve a la reducción síncrona', async () => {
    class BrokenWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      postMessage() {
        queueMicrotask(() => this.onerror?.());
      }
      terminate() {}
    }
    globalThis.Worker = BrokenWorker as unknown as typeof Worker;
    const { result } = renderHook(() => useDownsampledSeries(longSeries(10_000), 'lttb'));
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(result.current.series.x).toHaveLength(1500);
    vi.restoreAllMocks();
  });

  it('si el constructor del Worker lanza, reduce de forma síncrona sin romper', async () => {
    class ThrowingWorker {
      constructor() {
        throw new Error('CSP');
      }
    }
    globalThis.Worker = ThrowingWorker as unknown as typeof Worker;
    const { result } = renderHook(() => useDownsampledSeries(longSeries(10_000), 'lttb'));
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(result.current.series.x).toHaveLength(1500);
  });

  it('es seguro bajo StrictMode: la petición cancelada no fija estado', async () => {
    const posted: DownsampleRequest[] = [];
    class FakeWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      postMessage(request: DownsampleRequest) {
        posted.push(request);
        queueMicrotask(() => this.onmessage?.({ data: handleDownsample(request) } as MessageEvent));
      }
      terminate() {}
    }
    globalThis.Worker = FakeWorker as unknown as typeof Worker;
    const series = longSeries(10_000);
    const { result } = renderHook(() => useDownsampledSeries(series, 'lttb'), { wrapper: StrictMode });
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(posted.length).toBeGreaterThanOrEqual(2);
    expect(result.current.series.x).toHaveLength(1500);
  });
});
