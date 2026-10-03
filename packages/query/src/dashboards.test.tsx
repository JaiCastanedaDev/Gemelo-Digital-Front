import type { Api } from '@gd/api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ApiProvider } from './ApiContext';
import { useComfort, useSensors } from './hooks';

function wrap(api: Api) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <ApiProvider api={api}>{children}</ApiProvider>
    </QueryClientProvider>
  );
}

describe('hooks de dashboards', () => {
  it('useComfort usa el endpoint del rol', async () => {
    const comfortAdmin = vi.fn().mockResolvedValue({ zones: [] });
    const comfortResidente = vi.fn().mockResolvedValue({ zones: [] });
    const api = { dashboard: { comfortAdmin, comfortResidente } } as unknown as Api;
    const { result } = renderHook(() => useComfort('RESIDENTE'), { wrapper: wrap(api) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(comfortResidente).toHaveBeenCalled();
    expect(comfortAdmin).not.toHaveBeenCalled();
  });

  it('useSensors no pide nada si está deshabilitado', () => {
    const list = vi.fn();
    const api = { sensors: { list } } as unknown as Api;
    renderHook(() => useSensors({ enabled: false }), { wrapper: wrap(api) });
    expect(list).not.toHaveBeenCalled();
  });
});
