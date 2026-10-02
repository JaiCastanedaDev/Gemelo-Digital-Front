import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AlertSound } from '../../features/realtime/alertSound';
import { resetDb } from '../../mocks/db';
import { emitMockAlert } from '../../mocks/emit';
import { realtimeBus } from '../../mocks/realtimeBus';
import { homeReady } from '../../test/homeReady';
import { createTestServices, loginAs, renderApp } from '../../test/renderApp';

afterEach(() => {
  vi.restoreAllMocks();
});

async function renderAdmin(options: { sound?: AlertSound } = {}) {
  const services = createTestServices();
  await loginAs(services, 'admin');
  renderApp(services, '/', options);
  // Espera datos renderizados (un commit posterior al primero): el cliente de tiempo real ya está suscrito.
  await homeReady();
  return services;
}

describe('cabecera', () => {
  it('la campana cuenta las alertas sin revisar y enlaza a ellas', async () => {
    await renderAdmin();
    const bell = await screen.findByRole('link', { name: 'Alertas: 2 sin revisar' });
    expect(bell).toHaveAttribute('href', '/alertas?acusada=false');
  });

  it('la campana avisa cuando hay críticas', async () => {
    resetDb('critico');
    await renderAdmin();
    expect(await screen.findByRole('link', { name: 'Alertas: 4 sin revisar, incluye críticas' })).toBeInTheDocument();
  });

  it('una alerta por socket actualiza la campana al instante', async () => {
    await renderAdmin();
    await screen.findByRole('link', { name: 'Alertas: 2 sin revisar' });
    act(() => {
      emitMockAlert({ level: 'CRITICAL' });
    });
    // La caché notifica a los observadores de forma asíncrona (microtarea/timer de TanStack Query).
    expect(await screen.findByRole('link', { name: 'Alertas: 3 sin revisar, incluye críticas' })).toBeInTheDocument();
  });

  it('el indicador dice "En vivo" y cambia a "Sin conexión" si cae el socket', async () => {
    await renderAdmin();
    expect(screen.getByText('En vivo')).toBeInTheDocument();
    act(() => realtimeBus.setStatus('disconnected'));
    expect(screen.getByText('Sin conexión')).toBeInTheDocument();
  });

  it('sin red muestra el banner de inmediato', async () => {
    await renderAdmin();
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    try {
      act(() => {
        window.dispatchEvent(new Event('offline'));
      });
      expect(await screen.findByText('Sin conexión con el servidor.')).toBeInTheDocument();
    } finally {
      // El onlineManager de TanStack Query es global y también escucha estos eventos: hay que
      // devolverlo a "en línea" o las consultas de los tests siguientes quedan en pausa.
      onLine.mockRestore();
      act(() => {
        window.dispatchEvent(new Event('online'));
      });
    }
  });

  it('si el navegador bloquea el audio ofrece "Activar sonido"', async () => {
    const unlock = vi.fn(async () => true);
    await renderAdmin({ sound: { play: async () => 'blocked', unlock } });
    expect(screen.queryByRole('button', { name: 'Activar sonido' })).not.toBeInTheDocument();
    await act(async () => {
      emitMockAlert({ level: 'CRITICAL' });
    });
    const button = await screen.findByRole('button', { name: 'Activar sonido' });
    await act(async () => {
      fireEvent.click(button);
    });
    expect(unlock).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Activar sonido' })).not.toBeInTheDocument();
  });
});
