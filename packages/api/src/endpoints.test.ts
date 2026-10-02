import { describe, expect, it, vi } from 'vitest';
import { createApi } from './endpoints';
import { createHttpClient } from './http';

const alert = {
  alert_id: 'alrt-20261002-00001',
  building_id: 'bld-1',
  sensor_id: 's1',
  level: 'CRITICAL',
  category: 'structural',
  message: 'm',
  timestamp: '2026-10-02T15:00:00Z',
  acknowledged: false,
  value_triggered: 1,
  threshold_configured: 0.5,
  occurrence_count: 3,
  acknowledged_by: null,
  acknowledged_at: null,
};

function apiReturning(body: unknown) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
  const api = createApi(
    createHttpClient({
      baseUrl: 'http://api.test',
      getAccessToken: () => 't',
      refreshAccessToken: async () => false,
      validation: 'strict',
      fetch: fetchMock as unknown as typeof fetch,
    }),
  );
  const call = (i = 0) => fetchMock.mock.calls[i] as unknown as [string, RequestInit];
  return { api, call };
}

describe('createApi', () => {
  it('alerts.listResidente filtra por query y nunca expone valores numéricos', async () => {
    const { api, call } = apiReturning({ count: 1, data: [alert] });
    const result = await api.alerts.listResidente({ level: 'CRITICAL', acknowledged: false });
    expect(call()[0]).toBe('http://api.test/api/v1/alerts?level=CRITICAL&acknowledged=false');
    expect(result.data[0]).not.toHaveProperty('value_triggered');
  });

  it('alerts.listAdmin conserva los campos de administrador', async () => {
    const { api } = apiReturning({ count: 1, data: [alert] });
    const result = await api.alerts.listAdmin();
    expect(result.data[0]?.occurrence_count).toBe(3);
  });

  it('alerts.ack hace POST con el id codificado', async () => {
    const { api, call } = apiReturning({ ...alert, acknowledged: true });
    await api.alerts.ack('alrt-20261002-00001');
    expect(call()[0]).toBe('http://api.test/api/v1/alerts/alrt-20261002-00001/ack');
    expect(call()[1].method).toBe('POST');
  });

  it('sensors.readings envía desde/hasta', async () => {
    const { api, call } = apiReturning([]);
    await api.sensors.readings('acc 1', { desde: '2026-10-01T00:00:00Z', hasta: '2026-10-02T00:00:00Z' });
    expect(call()[0]).toBe(
      'http://api.test/api/v1/sensors/acc%201/data?desde=2026-10-01T00%3A00%3A00Z&hasta=2026-10-02T00%3A00%3A00Z',
    );
  });
});
