import { screen, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { resetDb } from '../../mocks/db';
import { server } from '../../mocks/server';
import { createTestServices, loginAs, renderApp } from '../../test/renderApp';

async function scoreRegion() {
  return within(await screen.findByRole('region', { name: 'Salud del edificio' }));
}

describe('HomePage', () => {
  it('escenario sano: puntaje, banda y desglose', async () => {
    const services = createTestServices();
    await loginAs(services, 'admin');
    renderApp(services, '/');
    const region = await scoreRegion();
    expect(await region.findByText('96')).toBeInTheDocument();
    expect(region.getByText('Buen estado')).toBeInTheDocument();
    expect(region.getByText('−4 · 2 alertas informativas')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Alertas críticas sin revisar' })).not.toBeInTheDocument();
  });

  it('escenario crítico: banner con enlace directo a la alerta', async () => {
    resetDb('critico');
    const services = createTestServices();
    await loginAs(services, 'admin');
    renderApp(services, '/');
    const banner = await screen.findByRole('region', { name: 'Alertas críticas sin revisar' });
    expect(within(banner).getByText('1 alerta crítica sin revisar')).toBeInTheDocument();
    expect(within(banner).getByRole('link', { name: 'Ver alerta' })).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/alertas\?alerta=alrt-\d{8}-00004$/),
    );
    const region = await scoreRegion();
    expect(await region.findByText('56')).toBeInTheDocument();
    expect(region.getByText('Requiere atención')).toBeInTheDocument();
  });

  it('el administrador ve sensores en línea y sin datos; el residente no', async () => {
    resetDb('critico');
    const admin = createTestServices();
    await loginAs(admin, 'admin');
    const { unmount } = renderApp(admin, '/');
    expect(await screen.findByText('Sensores sin datos')).toBeInTheDocument();
    unmount();

    const residente = createTestServices();
    await loginAs(residente, 'residente');
    renderApp(residente, '/');
    await scoreRegion();
    expect(await screen.findByText('Alertas críticas')).toBeInTheDocument();
    expect(screen.queryByText('Sensores sin datos')).not.toBeInTheDocument();
  });

  it('el residente no ve el conteo ni los puntos de sensores sin datos en el desglose', async () => {
    resetDb('critico');
    const services = createTestServices();
    await loginAs(services, 'residente');
    renderApp(services, '/');
    const region = await scoreRegion();
    expect(await region.findByText('sensores sin datos')).toBeInTheDocument();
    const text = screen.getByRole('region', { name: 'Salud del edificio' }).textContent ?? '';
    expect(text).not.toMatch(/\d+\s+sensor(es)?\s+sin datos/);
    expect(text).not.toContain('−5 · ');
  });

  it('el residente no ve cuántos sensores están caídos en el escenario caído', async () => {
    resetDb('caido');
    const services = createTestServices();
    await loginAs(services, 'residente');
    renderApp(services, '/');
    const region = await scoreRegion();
    expect(await region.findByText('sensores sin datos')).toBeInTheDocument();
    const text = screen.getByRole('region', { name: 'Salud del edificio' }).textContent ?? '';
    expect(text).not.toContain('−30');
    expect(text).not.toContain('6 sensores');
  });

  it('el administrador sigue viendo el conteo y los puntos de sensores sin datos', async () => {
    resetDb('caido');
    const services = createTestServices();
    await loginAs(services, 'admin');
    renderApp(services, '/');
    const region = await scoreRegion();
    expect(await region.findByText('−30 · 6 sensores sin datos')).toBeInTheDocument();
  });

  it('acota un puntaje inválido del backend', async () => {
    server.use(
      http.get('*/api/v1/dashboard/general', () =>
        HttpResponse.json({
          health_score: -20,
          alerts_summary: { CRITICAL: 5, WARNING: 0, INFO: 0, total: 5 },
          sensors: { total: 1, online: 1, offline: 0 },
          generated_at: new Date().toISOString(),
        }),
      ),
    );
    const services = createTestServices();
    await loginAs(services, 'admin');
    renderApp(services, '/');
    const region = await scoreRegion();
    expect(await region.findByText('0')).toBeInTheDocument();
    expect(region.getByText('Atención prioritaria')).toBeInTheDocument();
  });

  it('marca el puntaje como desactualizado si generated_at es antiguo', async () => {
    server.use(
      http.get('*/api/v1/dashboard/general', () =>
        HttpResponse.json({
          health_score: 100,
          alerts_summary: { CRITICAL: 0, WARNING: 0, INFO: 0, total: 0 },
          sensors: { total: 1, online: 1, offline: 0 },
          generated_at: new Date(Date.now() - 10 * 60_000).toISOString(),
        }),
      ),
    );
    const services = createTestServices();
    await loginAs(services, 'admin');
    renderApp(services, '/');
    const region = await scoreRegion();
    expect(await region.findByText('Dato desactualizado')).toBeInTheDocument();
  });
});
