import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { resetDb } from '../../mocks/db';
import { createTestServices, loginAs, renderApp } from '../../test/renderApp';

async function openSensors(route = '/sensores') {
  const services = createTestServices();
  await loginAs(services, 'admin');
  renderApp(services, route);
  return screen.findByRole('table', { name: /^Sensores \(\d+\)$/ });
}

describe('página de sensores', () => {
  it('lista los 22 sensores con su estado', async () => {
    const table = await openSensors();
    expect(table).toHaveAccessibleName('Sensores (22)');
    expect(within(table).getAllByRole('row')).toHaveLength(23);
  });

  it('el contenedor desplazable de la tabla es enfocable', async () => {
    const table = await openSensors();
    const wrap = table.closest('[role="region"]');
    expect(wrap).toHaveAttribute('tabindex', '0');
    expect(wrap).toHaveAccessibleName('Tabla de sensores (desplazable)');
  });

  it('ordena por gravedad: lo crítico y lo que no reporta arriba', async () => {
    resetDb('critico');
    const table = await openSensors();
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('Crítico');
    expect(rows[2]).toHaveTextContent(/Sin datos desde/);
  });

  it('filtra por estado desde la URL', async () => {
    resetDb('caido');
    const table = await openSensors('/sensores?estado=OFFLINE');
    expect(table).toHaveAccessibleName('Sensores (6)');
  });

  it('los enlaces conservan los filtros', async () => {
    resetDb('caido');
    const table = await openSensors('/sensores?estado=OFFLINE');
    const link = within(table).getAllByRole('link')[0];
    expect(link?.getAttribute('href')).toContain('estado=OFFLINE');
    expect(link?.getAttribute('href')).toContain('sensor=');
  });

  it('abrir un sensor muestra su detalle', async () => {
    const table = await openSensors();
    await userEvent.click(within(table).getByRole('link', { name: 'Medidor acueducto principal' }));
    const panel = await screen.findByRole('complementary', { name: 'Detalle del sensor' });
    expect(within(panel).getByRole('heading', { name: 'Medidor acueducto principal' })).toBeInTheDocument();
  });

  it('la densidad por zona tiene alternativa en tabla', async () => {
    await openSensors();
    const density = screen.getByRole('region', { name: 'Sensores por zona' });
    expect(within(density).getByRole('img', { name: 'Sensores por zona y estado' })).toBeInTheDocument();
    await userEvent.click(within(density).getByRole('button', { name: 'Ver como tabla' }));
    const table = within(density).getByRole('table', { name: 'Sensores por zona y estado' });
    expect(within(table).getByRole('rowheader', { name: 'Gimnasio' })).toBeInTheDocument();
    const wrap = table.closest('[role="region"]');
    expect(wrap).toHaveAttribute('tabindex', '0');
    expect(wrap).toHaveAccessibleName('Sensores por zona y estado (desplazable)');
  });

  it('el home del administrador muestra la densidad por zona', async () => {
    const services = createTestServices();
    await loginAs(services, 'admin');
    renderApp(services, '/');
    expect(await screen.findByRole('region', { name: 'Sensores por zona' })).toBeInTheDocument();
  });

  it('el residente no ve la densidad en el home', async () => {
    const services = createTestServices();
    await loginAs(services, 'residente');
    renderApp(services, '/');
    await screen.findByRole('region', { name: 'Salud del edificio' });
    expect(screen.queryByRole('region', { name: 'Sensores por zona' })).not.toBeInTheDocument();
    expect(services.queryClient.getQueryCache().find({ queryKey: ['gd', 'sensors'] })).toBeUndefined();
  });
});
