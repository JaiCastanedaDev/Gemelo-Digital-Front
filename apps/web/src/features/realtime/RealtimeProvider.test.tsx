import type { AlertResidente } from '@gd/api';
import { queryKeys } from '@gd/query';
import type { RealtimeClient } from '@gd/realtime';
import { act, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { db, resetDb } from '../../mocks/db';
import { emitMockAlert } from '../../mocks/emit';
import { createMockRealtimeClient } from '../../mocks/realtime';
import { realtimeBus } from '../../mocks/realtimeBus';
import { createTestServices, loginAs, renderApp } from '../../test/renderApp';
import type { AlertSound } from './alertSound';

/**
 * Espera a que el home muestre el puntaje (datos cargados). La región existe desde el primer commit,
 * pero el cliente de tiempo real arranca en un efecto pasivo: esperar un render posterior garantiza
 * que ya está suscrito al bus antes de emitir.
 */
async function homeReady() {
  const region = await screen.findByRole('region', { name: 'Salud del edificio' });
  await within(region).findByText(/^\d+$/);
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

    let emittedId = '';
    act(() => {
      emittedId = emitMockAlert({ level: 'CRITICAL' }).alert_id;
    });

    const lists = services.queryClient.getQueriesData<{ data: AlertResidente[] }>({
      queryKey: [...queryKeys.alerts.all(), 'RESIDENTE'],
    });
    const alerts = lists.flatMap(([, list]) => list?.data ?? []);
    expect(alerts.map((a) => a.alert_id)).toContain(emittedId);
    for (const alert of alerts) {
      expect(alert).not.toHaveProperty('value_triggered');
      expect(alert).not.toHaveProperty('threshold_configured');
      expect(alert).not.toHaveProperty('occurrence_count');
    }
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

  it('al cerrar sesión y entrar otro usuario no hereda las notificaciones ni el título del anterior', async () => {
    const services = createTestServices();
    await loginAs(services, 'admin');
    renderApp(services, '/');
    await homeReady();

    act(() => {
      emitMockAlert({ level: 'CRITICAL' });
    });
    expect(within(toastRegion()).getByRole('alert')).toHaveTextContent('Aceleración superior al umbral configurado');
    document.title = '(1) ⚠ Alerta crítica · Gemelo Digital';

    await act(async () => {
      await services.session.logout();
    });
    await screen.findByRole('button', { name: 'Ingresar' });
    expect(document.title).toBe('Gemelo Digital');

    await act(async () => {
      await loginAs(services, 'residente');
    });
    await homeReady();

    expect(within(toastRegion()).queryByRole('alert')).toBeEmptyDOMElement();
    expect(within(toastRegion()).queryByText('Aceleración superior al umbral configurado')).not.toBeInTheDocument();
    expect(within(toastRegion()).queryByRole('link')).not.toBeInTheDocument();
  });

  it('si la sesión expira y vuelve el mismo usuario, conserva las notificaciones', async () => {
    const services = createTestServices();
    await loginAs(services, 'admin');
    renderApp(services, '/');
    await homeReady();

    act(() => {
      emitMockAlert({ level: 'CRITICAL' });
    });
    expect(within(toastRegion()).getByRole('alert')).toHaveTextContent('Aceleración superior al umbral configurado');

    db.settings.refreshValidAfterMs = Date.now() + 1;
    await new Promise((r) => setTimeout(r, 5));
    await act(async () => {
      await services.session.refresh();
    });
    await screen.findByRole('dialog', { name: 'Tu sesión expiró' });
    expect(within(toastRegion()).getByRole('alert')).toHaveTextContent('Aceleración superior al umbral configurado');

    await act(async () => {
      await loginAs(services, 'admin');
    });
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(within(toastRegion()).getByRole('alert')).toHaveTextContent('Aceleración superior al umbral configurado');
  });
});
