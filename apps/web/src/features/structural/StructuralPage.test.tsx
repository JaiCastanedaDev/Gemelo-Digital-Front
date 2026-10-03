import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { resetDb } from '../../mocks/db';
import { createTestServices, loginAs, renderApp } from '../../test/renderApp';

async function openStructural() {
  const services = createTestServices();
  await loginAs(services, 'admin');
  renderApp(services, '/estructural');
  return within(await screen.findByRole('region', { name: 'Salud estructural' }));
}

describe('página estructural', () => {
  it('en crítico: puntaje 60, banda y sensores en alerta', async () => {
    resetDb('critico');
    const health = await openStructural();
    expect(await health.findByText('60')).toBeInTheDocument();
    expect(health.getByText('Requiere atención')).toBeInTheDocument();
    const inAlert = screen.getByRole('region', { name: 'Sensores en alerta' });
    const link = await within(inAlert).findByRole('link', { name: /Acelerómetro Sótano Torre 1/ });
    expect(link).toHaveTextContent('Crítico');
    expect(link).toHaveTextContent('1 alerta');
    await userEvent.click(link);
    expect(await screen.findByRole('complementary', { name: 'Detalle del sensor' })).toBeInTheDocument();
  });

  it('en sano no hay sensores en alerta', async () => {
    const health = await openStructural();
    expect(await health.findByText('100')).toBeInTheDocument();
    expect(await screen.findByText('No hay sensores estructurales en alerta.')).toBeInTheDocument();
  });

  it('la lista de sensores estructurales muestra un estado fiable', async () => {
    await openStructural();
    const list = screen.getByRole('region', { name: 'Sensores estructurales' });
    expect(await within(list).findAllByRole('link')).not.toHaveLength(0);
    expect(await within(list).findAllByText('Normal')).not.toHaveLength(0);
  });
});
