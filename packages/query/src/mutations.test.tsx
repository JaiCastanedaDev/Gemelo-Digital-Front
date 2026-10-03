import { ContractDriftError, type AlertAdmin, type AlertListAdmin, type Api } from '@gd/api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ApiProvider } from './ApiContext';
import { queryKeys } from './keys';
import { useAckAlert } from './mutations';

const pendingAlert: AlertAdmin = {
  alert_id: 'alrt-20261002-00004',
  building_id: 'bld-1',
  sensor_id: 'acc-t1-sotano',
  level: 'CRITICAL',
  category: 'structural',
  message: 'Aceleración superior al umbral configurado',
  timestamp: '2026-10-02T15:00:00Z',
  acknowledged: false,
  value_triggered: 0.35,
  threshold_configured: 0.2,
  occurrence_count: 12,
  acknowledged_by: null,
  acknowledged_at: null,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setup(ack: (alertId: string) => Promise<AlertAdmin>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const api = { alerts: { ack: vi.fn(ack) } } as unknown as Api;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <ApiProvider api={api}>{children}</ApiProvider>
    </QueryClientProvider>
  );
  return { client, wrapper };
}

const unackedKey = queryKeys.alerts.list('ADMIN', { acknowledged: false });
const allKey = queryKeys.alerts.list('ADMIN', {});

describe('useAckAlert', () => {
  it('marca la alerta como revisada antes de que responda el servidor y luego aplica su versión', async () => {
    const server = deferred<AlertAdmin>();
    const { client, wrapper } = setup(() => server.promise);
    client.setQueryData<AlertListAdmin>(unackedKey, { count: 1, data: [pendingAlert] });
    client.setQueryData<AlertListAdmin>(allKey, { count: 1, data: [pendingAlert] });

    const { result } = renderHook(() => useAckAlert(), { wrapper });
    act(() => result.current.mutate(pendingAlert.alert_id));

    await waitFor(() => expect(client.getQueryData<AlertListAdmin>(allKey)?.data[0]?.acknowledged).toBe(true));
    expect(client.getQueryData<AlertListAdmin>(unackedKey)?.data[0]?.acknowledged).toBe(true);

    server.resolve({ ...pendingAlert, acknowledged: true, acknowledged_by: 'Administración Demo', acknowledged_at: '2026-10-02T15:05:00Z' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.getQueryData<AlertListAdmin>(allKey)?.data[0]?.acknowledged_by).toBe('Administración Demo');
    expect(client.getQueryData<AlertListAdmin>(unackedKey)?.data).toHaveLength(0);
  });

  it('revierte si el servidor falla', async () => {
    const { client, wrapper } = setup(() => Promise.reject(new Error('fallo simulado')));
    client.setQueryData<AlertListAdmin>(allKey, { count: 1, data: [pendingAlert] });

    const { result } = renderHook(() => useAckAlert(), { wrapper });
    act(() => result.current.mutate(pendingAlert.alert_id));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(client.getQueryData<AlertListAdmin>(allKey)?.data[0]?.acknowledged).toBe(false);
  });

  it('si la respuesta del acuse está fuera de contrato conserva el estado optimista y reconcilia por invalidación', async () => {
    const drift = new ContractDriftError({ method: 'POST', path: '/alerts/x/ack', issues: [] });
    const { client, wrapper } = setup(() => Promise.reject(drift));
    client.setQueryData<AlertListAdmin>(allKey, { count: 1, data: [pendingAlert] });
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useAckAlert(), { wrapper });
    act(() => result.current.mutate(pendingAlert.alert_id));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(client.getQueryData<AlertListAdmin>(allKey)?.data[0]?.acknowledged).toBe(true);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.alerts.all() });
  });
});
