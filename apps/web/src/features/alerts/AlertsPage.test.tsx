import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetDb } from '../../mocks/db';
import { createTestServices, loginAs, renderApp } from '../../test/renderApp';

async function openAlerts(who: 'admin' | 'residente', route = '/alertas') {
  const services = createTestServices();
  await loginAs(services, who);
  renderApp(services, route);
  return within(await screen.findByRole('list', { name: 'Alertas' }));
}

describe('centro de alertas', () => {
  it('ordena: sin revisar primero, la crítica arriba', async () => {
    resetDb('critico');
    const list = await openAlerts('admin');
    const rows = list.getAllByRole('link');
    expect(rows[0]).toHaveTextContent('Crítico');
    expect(rows.at(-1)).toHaveTextContent('Revisada');
  });

  it('el administrador ve las ocurrencias', async () => {
    resetDb('critico');
    const adminList = await openAlerts('admin');
    expect(adminList.getByText('×12 ocurrencias')).toBeInTheDocument();
  });

  it('el residente no ve ocurrencias', async () => {
    resetDb('critico');
    const list = await openAlerts('residente');
    expect(list.queryByText(/ocurrencias/)).not.toBeInTheDocument();
  });

  it('filtra por nivel desde la URL', async () => {
    resetDb('critico');
    const list = await openAlerts('admin', '/alertas?nivel=WARNING');
    const rows = list.getAllByRole('link');
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row).toHaveTextContent('Advertencia');
  });

  it('filtra por categoría en el cliente', async () => {
    resetDb('critico');
    await openAlerts('admin');
    fireEvent.change(screen.getByLabelText('Categoría'), { target: { value: 'comfort' } });
    const list = within(await screen.findByRole('list', { name: 'Alertas' }));
    for (const row of list.getAllByRole('link')) expect(row).toHaveTextContent('Calidad del aire');
  });

  it('parámetros inválidos muestran todas las alertas', async () => {
    resetDb('critico');
    const list = await openAlerts('admin', '/alertas?nivel=PANICO&categoria=apartamento');
    expect(list.getAllByRole('link')).toHaveLength(5);
  });

  it('sin alertas muestra el estado vacío', async () => {
    resetDb('vacio');
    const services = createTestServices();
    await loginAs(services, 'admin');
    renderApp(services, '/alertas');
    expect(await screen.findByText('No hay alertas con estos filtros.')).toBeInTheDocument();
  });
});

describe('filtros de sensor y fechas', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('filtra por sensor desde la URL', async () => {
    resetDb('critico');
    const list = await openAlerts('admin', '/alertas?sensor=acc-t1-sotano');
    // En crítico, acc-t1-sotano tiene exactamente una alerta (CRITICAL, ocurrencia 12).
    expect(list.getAllByRole('link')).toHaveLength(1);
    expect(list.getByRole('link')).toHaveTextContent('Crítico');
  });

  it('filtra por fechas en hora de Bogotá', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-02T18:00:00Z')); // 1:00 p. m. en Bogotá: las alertas sembradas caen el 2 oct
    resetDb('critico');
    const all = (await openAlerts('admin')).getAllByRole('link').length;
    cleanup();
    const today = await openAlerts('admin', '/alertas?desde=2026-10-02&hasta=2026-10-02');
    expect(today.getAllByRole('link')).toHaveLength(all);
    cleanup();
    const services = createTestServices();
    await loginAs(services, 'admin');
    renderApp(services, '/alertas?desde=2026-10-03');
    expect(await screen.findByText('No hay alertas con estos filtros.')).toBeInTheDocument();
  });

  it('un rango invertido avisa y no filtra', async () => {
    resetDb('critico');
    await openAlerts('admin', '/alertas?desde=2026-10-05&hasta=2026-10-01');
    expect(screen.getByText('La fecha inicial es posterior a la final; no se aplica el filtro de fechas.')).toBeInTheDocument();
  });
});
