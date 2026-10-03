import type { AlertListAdmin, AlertAdmin } from '@gd/api';
import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { acknowledgeInList, applyAlertToCache, markAlertAcknowledged, upsertAlertList } from './alertCache';
import { queryKeys } from './keys';

const alert = (id: string, overrides: Partial<AlertAdmin> = {}): AlertAdmin => ({
  alert_id: id,
  building_id: 'bld-1',
  sensor_id: 's1',
  level: 'CRITICAL',
  category: 'structural',
  message: 'm',
  timestamp: '2026-10-02T15:00:00Z',
  acknowledged: false,
  value_triggered: 1,
  threshold_configured: 0.5,
  occurrence_count: 1,
  acknowledged_by: null,
  acknowledged_at: null,
  ...overrides,
});

describe('upsertAlertList', () => {
  it('inserta una alerta nueva que cumple el filtro, ordenada por fecha desc', () => {
    const list = { count: 1, data: [alert('a', { timestamp: '2026-10-02T10:00:00Z' })] };
    const next = upsertAlertList(list, alert('b', { timestamp: '2026-10-02T12:00:00Z' }), { acknowledged: false });
    expect(next.data.map((x) => x.alert_id)).toEqual(['b', 'a']);
    expect(next.count).toBe(2);
  });

  it('reemplaza por alert_id en vez de duplicar (nueva ocurrencia)', () => {
    const list = { count: 1, data: [alert('a', { occurrence_count: 1 })] };
    const next = upsertAlertList(list, alert('a', { occurrence_count: 2 }), {});
    expect(next.data).toHaveLength(1);
    expect(next.data[0]?.occurrence_count).toBe(2);
  });

  it('quita la alerta si ya no cumple el filtro', () => {
    const list = { count: 1, data: [alert('a')] };
    const next = upsertAlertList(list, alert('a', { acknowledged: true }), { acknowledged: false });
    expect(next.data).toHaveLength(0);
    expect(next.count).toBe(0);
  });

  it('respeta el filtro de nivel', () => {
    const list = { count: 0, data: [] as AlertAdmin[] };
    expect(upsertAlertList(list, alert('w', { level: 'WARNING' }), { level: 'CRITICAL' }).data).toHaveLength(0);
  });
});

describe('markAlertAcknowledged', () => {
  it('marca solo la alerta indicada', () => {
    const list = { count: 2, data: [alert('a'), alert('b')] };
    const next = markAlertAcknowledged(list, 'b');
    expect(next.data.map((x) => x.acknowledged)).toEqual([false, true]);
  });
});

describe('acknowledgeInList', () => {
  it('quita la alerta de una lista filtrada por sin revisar', () => {
    const list = { count: 2, data: [alert('a'), alert('b')] };
    const next = acknowledgeInList(list, 'a', { acknowledged: false });
    expect(next.data.map((x) => x.alert_id)).toEqual(['b']);
    expect(next.count).toBe(1);
  });

  it('la deja marcada en la lista sin filtrar', () => {
    const list = { count: 2, data: [alert('a'), alert('b')] };
    const next = acknowledgeInList(list, 'a', {});
    expect(next.data.map((x) => [x.alert_id, x.acknowledged])).toEqual([
      ['a', true],
      ['b', false],
    ]);
  });

  it('no cambia nada si la alerta no está en la lista', () => {
    const list = { count: 1, data: [alert('b')] };
    expect(acknowledgeInList(list, 'zz', { acknowledged: false })).toBe(list);
  });
});

describe('applyAlertToCache', () => {
  it('actualiza todas las listas del rol y no toca las del otro rol', () => {
    const client = new QueryClient();
    const unacked = queryKeys.alerts.list('ADMIN', { acknowledged: false });
    const all = queryKeys.alerts.list('ADMIN', {});
    const residente = queryKeys.alerts.list('RESIDENTE', {});
    client.setQueryData<AlertListAdmin>(unacked, { count: 0, data: [] });
    client.setQueryData<AlertListAdmin>(all, { count: 0, data: [] });
    client.setQueryData(residente, { count: 0, data: [] });

    applyAlertToCache(client, 'ADMIN', alert('n1'));

    expect(client.getQueryData<AlertListAdmin>(unacked)?.data.map((x) => x.alert_id)).toEqual(['n1']);
    expect(client.getQueryData<AlertListAdmin>(all)?.data.map((x) => x.alert_id)).toEqual(['n1']);
    expect(client.getQueryData<AlertListAdmin>(residente)?.data).toEqual([]);
  });
});
