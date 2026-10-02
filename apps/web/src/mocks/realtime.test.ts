import { ApiError, MemoryTokenStore, createApi, createHttpClient, createSessionManager, type AlertAdmin } from '@gd/api';
import { describe, expect, it, vi } from 'vitest';
import { db, resetDb } from './db';
import { emitMockAlert } from './emit';
import { createMockRealtimeClient } from './realtime';
import { realtimeBus } from './realtimeBus';
import { ADMIN_EMAIL, DEMO_PASSWORD, RESIDENTE_EMAIL } from './seed';

const BASE = 'http://localhost';

async function apiAs(email: string) {
  const session = createSessionManager({ baseUrl: BASE, store: new MemoryTokenStore() });
  const http = createHttpClient({
    baseUrl: BASE,
    getAccessToken: () => session.getAccessToken(),
    refreshAccessToken: () => session.refresh(),
    validation: 'strict',
  });
  await session.login(email, DEMO_PASSWORD);
  return createApi(http);
}

function criticalId(): string {
  const found = db.alerts.find((a) => a.level === 'CRITICAL');
  if (!found) throw new Error('el escenario no tiene alerta crítica');
  return found.alert_id;
}

describe('acuse simulado', () => {
  it('el administrador marca la alerta como revisada', async () => {
    resetDb('critico');
    const api = await apiAs(ADMIN_EMAIL);
    const updated = await api.alerts.ack(criticalId());
    expect(updated.acknowledged).toBe(true);
    expect(updated.acknowledged_by).toBe('Administración Demo');
    expect(updated.acknowledged_at).not.toBeNull();
  });

  it('el residente recibe 403', async () => {
    resetDb('critico');
    const api = await apiAs(RESIDENTE_EMAIL);
    await expect(api.alerts.ack(criticalId())).rejects.toMatchObject({ status: 403 });
  });

  it('una alerta inexistente da 404', async () => {
    const api = await apiAs(ADMIN_EMAIL);
    await expect(api.alerts.ack('alrt-00000000-99999')).rejects.toMatchObject({ status: 404 });
  });

  it('failNextAck falla una sola vez', async () => {
    resetDb('critico');
    const api = await apiAs(ADMIN_EMAIL);
    db.settings.failNextAck = true;
    const err = await api.alerts.ack(criticalId()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 500 });
    await expect(api.alerts.ack(criticalId())).resolves.toMatchObject({ acknowledged: true });
  });
});

describe('emisor de alertas', () => {
  it('crea una alerta con el siguiente id y la publica', () => {
    resetDb('sano');
    const received = vi.fn();
    realtimeBus.subscribeAlerts(received);
    const alert = emitMockAlert({ level: 'CRITICAL' });
    expect(alert.alert_id).toMatch(/^alrt-\d{8}-00004$/);
    expect(db.alerts).toContainEqual(expect.objectContaining({ alert_id: alert.alert_id }));
    expect(received).toHaveBeenCalledWith(expect.objectContaining({ alert_id: alert.alert_id, level: 'CRITICAL' }));
  });

  it('una nueva ocurrencia reutiliza el id y sube occurrence_count', () => {
    resetDb('sano');
    const first = emitMockAlert({ level: 'WARNING' });
    const second = emitMockAlert({ level: 'WARNING' });
    expect(second.alert_id).toBe(first.alert_id);
    expect(second.occurrence_count).toBe(2);
    expect(db.alerts.filter((a) => a.alert_id === first.alert_id)).toHaveLength(1);
  });
});

describe('cliente de tiempo real simulado', () => {
  it('sigue el estado del bus y entrega la forma del rol', () => {
    const admin = createMockRealtimeClient('ADMIN');
    const residente = createMockRealtimeClient('RESIDENTE');
    const adminAlerts: AlertAdmin[] = [];
    const residenteAlerts: unknown[] = [];
    admin.onAlert((a) => adminAlerts.push(a as AlertAdmin));
    residente.onAlert((a) => residenteAlerts.push(a));
    admin.start();
    residente.start();
    expect(admin.getStatus()).toBe('connected');

    emitMockAlert({ level: 'CRITICAL' });
    expect(adminAlerts[0]?.value_triggered).toBe(0.41);
    expect(residenteAlerts[0]).not.toHaveProperty('value_triggered');

    realtimeBus.setStatus('disconnected');
    expect(admin.getStatus()).toBe('disconnected');

    admin.stop();
    emitMockAlert({ level: 'WARNING' });
    expect(adminAlerts).toHaveLength(1);
    expect(admin.getStatus()).toBe('idle');
  });
});
