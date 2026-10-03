import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { resetDb } from '../../mocks/db';
import { createTestServices, loginAs, renderApp } from '../../test/renderApp';

async function openComfort(who: 'admin' | 'residente') {
  const services = createTestServices();
  await loginAs(services, who);
  renderApp(services, '/aire');
  return within(await screen.findByRole('list', { name: 'Zonas' }));
}

describe('página de calidad del aire', () => {
  it('el administrador ve la etiqueta, los ppm y puede abrir las lecturas', async () => {
    resetDb('critico');
    const zones = await openComfort('admin');
    const salon = zones.getByRole('listitem', { name: 'Salón social' });
    expect(salon).toHaveTextContent('Mala');
    expect(salon).toHaveTextContent('1.450 ppm');
    await userEvent.click(within(salon).getByRole('link', { name: 'Ver lecturas de Salón social' }));
    expect(await screen.findByRole('complementary', { name: 'Detalle del sensor' })).toBeInTheDocument();
  });

  it('el residente solo ve la etiqueta: sin ppm, sin lecturas', async () => {
    resetDb('critico');
    const zones = await openComfort('residente');
    expect(zones.getByRole('listitem', { name: 'Salón social' })).toHaveTextContent('Mala');
    expect(screen.queryByText(/ppm/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Ver lecturas/ })).not.toBeInTheDocument();
  });

  it('el residente no puede abrir el detalle aunque ponga ?sensor= en la URL', async () => {
    const services = createTestServices();
    await loginAs(services, 'residente');
    renderApp(services, '/aire?sensor=co2-salon');
    await screen.findByRole('list', { name: 'Zonas' });
    expect(screen.queryByRole('complementary', { name: 'Detalle del sensor' })).not.toBeInTheDocument();
    const keys = services.queryClient.getQueryCache().getAll().map((q) => q.queryKey);
    expect(keys.some((k) => k[0] === 'gd' && k[1] === 'sensors')).toBe(false);
  });
});
