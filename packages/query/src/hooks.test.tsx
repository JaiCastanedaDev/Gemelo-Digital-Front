import type { Api } from '@gd/api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ApiProvider } from './ApiContext';
import { useAlerts, useDashboardGeneral } from './hooks';

const general = {
  health_score: 96,
  alerts_summary: { CRITICAL: 0, WARNING: 0, INFO: 2, total: 2 },
  sensors: { total: 22, online: 22, offline: 0 },
  generated_at: '2026-10-02T15:00:00Z',
};

function wrapper(api: Api) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <ApiProvider api={api}>{children}</ApiProvider>
    </QueryClientProvider>
  );
}

describe('hooks de @gd/query', () => {
  it('useDashboardGeneral obtiene el estado general', async () => {
    const api = { dashboard: { general: vi.fn().mockResolvedValue(general) } } as unknown as Api;
    const { result } = renderHook(() => useDashboardGeneral(), { wrapper: wrapper(api) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.health_score).toBe(96);
  });

  it('useAlerts usa el endpoint del rol con los filtros', async () => {
    const listResidente = vi.fn().mockResolvedValue({ count: 0, data: [] });
    const listAdmin = vi.fn();
    const api = { alerts: { listResidente, listAdmin } } as unknown as Api;
    const { result } = renderHook(() => useAlerts('RESIDENTE', { level: 'CRITICAL', acknowledged: false }), {
      wrapper: wrapper(api),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(listResidente).toHaveBeenCalledWith({ level: 'CRITICAL', acknowledged: false }, expect.anything());
    expect(listAdmin).not.toHaveBeenCalled();
  });

  it('useApi fuera del provider lanza un error claro', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const client = new QueryClient();
      expect(() =>
        renderHook(() => useDashboardGeneral(), {
          wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
        }),
      ).toThrow(/ApiProvider/);
    } finally {
      consoleError.mockRestore();
    }
  });
});
