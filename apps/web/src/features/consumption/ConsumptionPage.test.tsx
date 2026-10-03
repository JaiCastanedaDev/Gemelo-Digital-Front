import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { resetDb } from '../../mocks/db';
import { createTestServices, loginAs, renderApp } from '../../test/renderApp';

async function openConsumption() {
  const services = createTestServices();
  await loginAs(services, 'admin');
  renderApp(services, '/consumos');
  await screen.findByRole('heading', { name: 'Consumos', level: 1 });
}

describe('página de consumos', () => {
  it('muestra el mes en curso, el anterior y la variación', async () => {
    await openConsumption();
    const water = within(await screen.findByRole('region', { name: 'Consumo en m³' }));
    expect(water.getByText(/1\.234,5/)).toBeInTheDocument();
    expect(water.getByText('↑ 12,2 % frente al mismo tramo del mes anterior')).toHaveAttribute('data-direction', 'up');
    const power = within(screen.getByRole('region', { name: 'Consumo en kWh' }));
    expect(power.getByText('↓ 6,5 % frente al mismo tramo del mes anterior')).toHaveAttribute('data-direction', 'down');
    expect(water.getByRole('img', { name: /Comparación del consumo en m³/ })).toBeInTheDocument();
  });

  it('sin periodo anterior lo dice y nunca muestra 0 %', async () => {
    resetDb('caido');
    await openConsumption();
    const power = within(await screen.findByRole('region', { name: 'Consumo en kWh' }));
    expect(power.getByText('Sin datos del periodo anterior')).toBeInTheDocument();
    expect(power.queryByText(/0 %/)).not.toBeInTheDocument();
  });

  it('sin consumos muestra el estado vacío', async () => {
    resetDb('vacio');
    await openConsumption();
    expect(await screen.findByText('Aún no hay consumos registrados este mes.')).toBeInTheDocument();
  });
});
