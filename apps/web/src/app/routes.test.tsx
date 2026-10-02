import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { db } from '../mocks/db';
import { DEMO_PASSWORD } from '../mocks/seed';
import { createTestServices, loginAs, renderApp } from '../test/renderApp';

describe('rutas y guardas', () => {
  it('sin sesión redirige al login conservando la ruta pedida', async () => {
    const services = createTestServices();
    renderApp(services, '/aire');
    expect(await screen.findByRole('button', { name: 'Ingresar' })).toBeInTheDocument();
  });

  it('el residente ve solo sus secciones en el menú', async () => {
    const services = createTestServices();
    await loginAs(services, 'residente');
    renderApp(services, '/aire');
    const nav = await screen.findByRole('navigation', { name: 'Secciones' });
    expect(within(nav).getByRole('link', { name: 'Calidad del aire' })).toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'Sensores' })).not.toBeInTheDocument();
  });

  it('el residente que entra a una ruta de administrador ve "sin permiso"', async () => {
    const services = createTestServices();
    await loginAs(services, 'residente');
    renderApp(services, '/sensores');
    expect(await screen.findByRole('heading', { name: 'Sin permiso' })).toBeInTheDocument();
  });

  it('el administrador ve todas las secciones', async () => {
    const services = createTestServices();
    await loginAs(services, 'admin');
    renderApp(services, '/sensores');
    const nav = await screen.findByRole('navigation', { name: 'Secciones' });
    expect(within(nav).getAllByRole('link')).toHaveLength(9);
    expect(screen.getByRole('heading', { name: 'Sensores' })).toBeInTheDocument();
  });

  it('ruta desconocida muestra "Página no encontrada"', async () => {
    const services = createTestServices();
    await loginAs(services, 'admin');
    renderApp(services, '/no-existe');
    expect(await screen.findByRole('heading', { name: 'Página no encontrada' })).toBeInTheDocument();
  });

  it('si la sesión expira, aparece el modal y al volver a entrar sigue en la misma pantalla', async () => {
    const services = createTestServices();
    await loginAs(services, 'admin');
    renderApp(services, '/aire');
    await screen.findByRole('heading', { name: 'Calidad del aire' });

    db.settings.refreshValidAfterMs = Date.now() + 1;
    await new Promise((r) => setTimeout(r, 5));
    await services.session.refresh();

    const dialog = await screen.findByRole('dialog', { name: 'Tu sesión expiró' });
    expect(within(dialog).getByLabelText('Correo electrónico')).toHaveValue('admin@demo.co');
    await userEvent.type(within(dialog).getByLabelText('Contraseña'), DEMO_PASSWORD);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ingresar' }));

    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('heading', { name: 'Calidad del aire' })).toBeInTheDocument();
  });

  it('cerrar sesión vuelve al login', async () => {
    const services = createTestServices();
    await loginAs(services, 'admin');
    renderApp(services, '/aire');
    await userEvent.click(await screen.findByRole('button', { name: 'Cerrar sesión' }));
    expect(await screen.findByRole('button', { name: 'Ingresar' })).toBeInTheDocument();
  });
});
