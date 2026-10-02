import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { createTestServices, loginAs } from '../../test/renderApp';
import { AppProviders } from '../AppProviders';
import { AppShell } from './AppShell';

let shouldThrow = true;

function Breakable() {
  if (shouldThrow) throw new Error('fallo de render en la sección');
  return <p>Sección recuperada</p>;
}

async function renderShell() {
  const services = createTestServices();
  await loginAs(services, 'admin');
  render(
    <AppProviders services={services}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Breakable />} />
            <Route path="alertas" element={<p>Sección de alertas</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  );
}

describe('RouteErrorBoundary', () => {
  let consoleError: MockInstance<typeof console.error>;

  beforeEach(() => {
    shouldThrow = true;
    // React registra el error esperado por console.error; se silencia solo en estas pruebas.
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    consoleError.mockRestore();
  });

  it('un error de render en la sección muestra el mensaje y conserva el menú', async () => {
    await renderShell();
    expect(await screen.findByText('Algo salió mal en esta sección.')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Secciones' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver al estado general' })).toHaveAttribute('href', '/');
    expect(consoleError).toHaveBeenCalled();
  });

  it('"Reintentar" vuelve a renderizar la sección', async () => {
    await renderShell();
    await screen.findByText('Algo salió mal en esta sección.');
    shouldThrow = false;
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Sección recuperada')).toBeInTheDocument();
    expect(screen.queryByText('Algo salió mal en esta sección.')).not.toBeInTheDocument();
  });

  it('navegar a otra ruta limpia el error', async () => {
    await renderShell();
    await screen.findByText('Algo salió mal en esta sección.');
    await userEvent.click(screen.getByRole('link', { name: 'Alertas' }));
    expect(await screen.findByText('Sección de alertas')).toBeInTheDocument();
    expect(screen.queryByText('Algo salió mal en esta sección.')).not.toBeInTheDocument();
  });
});
