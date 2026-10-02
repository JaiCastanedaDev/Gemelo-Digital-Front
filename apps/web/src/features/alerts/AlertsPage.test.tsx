import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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
