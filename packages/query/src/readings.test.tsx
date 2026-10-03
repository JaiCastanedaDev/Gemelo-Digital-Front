import type { Api, Reading } from '@gd/api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiProvider } from './ApiContext';
import { useSensorReadings } from './readings';

const NOW = new Date('2026-10-02T15:00:00Z');

function setup() {
  const readings = vi.fn(async (_id: string, range: { desde?: string; hasta?: string }): Promise<Reading[]> => [
    { timestamp: range.desde ?? '', unit: 'g', values: { x: 1 }, battery_pct: 90 },
  ]);
  const api = { sensors: { readings } } as unknown as Api;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <ApiProvider api={api}>{children}</ApiProvider>
    </QueryClientProvider>
  );
  return { readings, wrapper, client };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('useSensorReadings', () => {
  it('pide un tramo por día UTC y junta las lecturas', async () => {
    const { readings, wrapper } = setup();
    const { result } = renderHook(() => useSensorReadings('acc-1', '24h'), { wrapper });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(readings).toHaveBeenCalledTimes(2);
    expect(readings.mock.calls.map((c) => c[1])).toEqual([
      { desde: '2026-10-01T00:00:00.000Z', hasta: '2026-10-02T00:00:00.000Z' },
      { desde: '2026-10-02T00:00:00.000Z', hasta: '2026-10-03T00:00:00.000Z' },
    ]);
    expect(result.current.readings).toHaveLength(2);
    expect(result.current.tooMany).toBe(false);
  });

  it('al ampliar el rango reutiliza los tramos ya pedidos', async () => {
    const { readings, wrapper } = setup();
    const { result, rerender } = renderHook(({ range }: { range: '24h' | '7d' }) => useSensorReadings('acc-1', range), {
      wrapper,
      initialProps: { range: '24h' },
    });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    rerender({ range: '7d' });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(readings).toHaveBeenCalledTimes(8);
  });

  it('la lista de lecturas conserva su identidad si los datos no cambian', async () => {
    const { wrapper } = setup();
    const { result, rerender } = renderHook(() => useSensorReadings('acc-1', '24h'), { wrapper });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    const first = result.current.readings;
    rerender();
    expect(result.current.readings).toBe(first);
  });

  it('sin sensor no pide nada', () => {
    const { readings, wrapper } = setup();
    const { result } = renderHook(() => useSensorReadings(null, '24h'), { wrapper });
    expect(readings).not.toHaveBeenCalled();
    expect(result.current.isPending).toBe(false);
    expect(result.current.readings).toEqual([]);
  });
});
