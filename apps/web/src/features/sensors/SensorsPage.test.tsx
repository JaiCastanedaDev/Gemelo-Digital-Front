import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { resetDb } from '../../mocks/db';
import { server } from '../../mocks/server';
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

  it('vaciar un filtro quita su parámetro de la URL', async () => {
    const table = await openSensors('/sensores?estado=OFFLINE');
    await userEvent.selectOptions(screen.getByLabelText('Estado'), '');
    expect(await screen.findByRole('table', { name: 'Sensores (22)' })).toBe(table);
    expect(within(table).getAllByRole('link')[0]?.getAttribute('href')).not.toContain('estado=');
  });

  describe('sin alertas cargadas', () => {
    it('nunca muestra "Normal", avisa y no dibuja la densidad', async () => {
      resetDb('critico');
      server.use(http.get('*/api/v1/alerts', () => new HttpResponse(null, { status: 500 })));
      const table = await openSensors();
      const density = await screen.findByRole('region', { name: 'Sensores por zona' });
      expect(await within(density).findByRole('alert')).toHaveTextContent(
        'No pudimos cargar las alertas; el estado de los sensores no está completo.',
      );
      expect(within(density).getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
      expect(within(table).queryByText('Normal')).not.toBeInTheDocument();
      expect(within(table).getAllByText('Estado no disponible').length).toBeGreaterThan(0);
      expect(within(density).queryByRole('img')).not.toBeInTheDocument();
      expect(within(density).queryByRole('button', { name: 'Ver como tabla' })).not.toBeInTheDocument();
    });

    it('el detalle del sensor tampoco lo muestra como normal', async () => {
      server.use(http.get('*/api/v1/alerts', () => new HttpResponse(null, { status: 500 })));
      await openSensors('/sensores?sensor=water-main');
      const panel = await screen.findByRole('complementary', { name: 'Detalle del sensor' });
      expect(await within(panel).findByText('Estado no disponible')).toBeInTheDocument();
      expect(within(panel).queryByText('Normal')).not.toBeInTheDocument();
    });

    it('el home del administrador no cuenta sensores sin saber las alertas', async () => {
      server.use(http.get('*/api/v1/alerts', () => new HttpResponse(null, { status: 500 })));
      const services = createTestServices();
      await loginAs(services, 'admin');
      renderApp(services, '/');
      const density = await screen.findByRole('region', { name: 'Sensores por zona' });
      expect(await within(density).findByRole('alert')).toBeInTheDocument();
      expect(within(density).queryByRole('img')).not.toBeInTheDocument();
    });
  });
});
