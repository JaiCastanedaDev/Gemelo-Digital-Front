import type { AlertResidente } from '@gd/api';
import { queryKeys } from '@gd/query';
import type { RealtimeClient } from '@gd/realtime';
import { act, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { resetDb } from '../../mocks/db';
import { emitMockAlert } from '../../mocks/emit';
import { createMockRealtimeClient } from '../../mocks/realtime';
import { realtimeBus } from '../../mocks/realtimeBus';
import { createTestServices, loginAs, renderApp } from '../../test/renderApp';
import type { AlertSound } from './alertSound';

async function homeReady() {
  await screen.findByRole('region', { name: 'Salud del edificio' });
}

function toastRegion() {
  return screen.getByRole('region', { name: 'Notificaciones' });
}

describe('RealtimeProvider', () => {
  it('una alerta crítica por socket aparece al instante como notificación y en el banner del home', async () => {
    const services = createTestServices();
    await loginAs(services, 'admin');
    renderApp(services, '/');
    await homeReady();

    act(() => {
      emitMockAlert({ level: 'CRITICAL' });
    });

    expect(within(toastRegion()).getByRole('alert')).toHaveTextContent('Aceleración superior al umbral configurado');
    expect(await screen.findByRole('region', { name: 'Alertas críticas sin revisar' })).toHaveTextContent(
      '1 alerta crítica sin revisar',
    );
  });

  it('una advertencia va a la región de estado y no hace sonar nada', async () => {
    const play = vi.fn(async () => 'played' as const);
    const sound: AlertSound = { play, unlock: async () => true };
    const services = createTestServices();
    await loginAs(services, 'admin');
    renderApp(services, '/', { sound });
    await homeReady();

    act(() => {
      emitMockAlert({ level: 'WARNING' });
    });

    expect(within(toastRegion()).getByRole('status')).toHaveTextContent('Cambio medido en la apertura de fisura');
    expect(play).not.toHaveBeenCalled();

    act(() => {
      emitMockAlert({ level: 'CRITICAL' });
    });
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('al residente le llegan alertas sin números a la caché', async () => {
    const services = createTestServices();
    await loginAs(services, 'residente');
    renderApp(services, '/');
    await homeReady();

    act(() => {
      emitMockAlert({ level: 'CRITICAL' });
    });

    const lists = services.queryClient.getQueriesData<{ data: AlertResidente[] }>({
      queryKey: [...queryKeys.alerts.all(), 'RESIDENTE'],
    });
    const alerts = lists.flatMap(([, list]) => list?.data ?? []);
    expect(alerts.length).toBeGreaterThan(0);
    for (const alert of alerts) expect(alert).not.toHaveProperty('value_triggered');
  });

  it('al rotar el token reconecta una sola vez y al cerrar sesión detiene el cliente', async () => {
    const clients: RealtimeClient[] = [];
    const services = createTestServices({
      createRealtime: ({ role }) => {
        const client = createMockRealtimeClient(role);
        vi.spyOn(client, 'tokenChanged');
        vi.spyOn(client, 'stop');
        clients.push(client);
        return client;
      },
    });
    await loginAs(services, 'admin');
    renderApp(services, '/');
    await homeReady();

    const active = clients.at(-1);
    if (!active) throw new Error('no se creó el cliente de tiempo real');
    expect(active.tokenChanged).not.toHaveBeenCalled();

    await act(async () => {
      await services.session.refresh();
    });
    expect(active.tokenChanged).toHaveBeenCalledTimes(1);

    await act(async () => {
      await services.session.logout();
    });
    expect(active.stop).toHaveBeenCalled();
  });

  it('al renovar el token pide de nuevo alertas y estado general (el socket sigue conectado durante el handshake)', async () => {
    const services = createTestServices();
    await loginAs(services, 'admin');
    renderApp(services, '/');
    await homeReady();
    const invalidate = vi.spyOn(services.queryClient, 'invalidateQueries');

    await act(async () => {
      await services.session.refresh();
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.alerts.all() });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.dashboard.general() });
  });

  it('al reconectar recupera alertas y estado general', async () => {
    const services = createTestServices();
    await loginAs(services, 'admin');
    renderApp(services, '/');
    await homeReady();
    const invalidate = vi.spyOn(services.queryClient, 'invalidateQueries');

    act(() => realtimeBus.setStatus('reconnecting'));
    act(() => realtimeBus.setStatus('connected'));

    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.alerts.all() });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.dashboard.general() });
  });

  it('en el escenario crítico la crítica nueva reemplaza la ocurrencia en vez de duplicarla', async () => {
    resetDb('critico');
    const services = createTestServices();
    await loginAs(services, 'admin');
    renderApp(services, '/');
    const banner = await screen.findByRole('region', { name: 'Alertas críticas sin revisar' });
    expect(banner).toHaveTextContent('1 alerta crítica sin revisar');

    act(() => {
      emitMockAlert({ level: 'CRITICAL' });
    });

    expect(banner).toHaveTextContent('1 alerta crítica sin revisar');
    expect(within(toastRegion()).getAllByText('Aceleración superior al umbral configurado')).toHaveLength(1);
  });
});
