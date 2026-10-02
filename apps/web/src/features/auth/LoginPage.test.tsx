import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AppProviders } from '../../app/AppProviders';
import { ADMIN_EMAIL, DEMO_PASSWORD } from '../../mocks/seed';
import { createTestServices } from '../../test/renderApp';
import { LoginPage } from './LoginPage';

function Where() {
  const location = useLocation();
  return <p>Ruta actual: {location.pathname}</p>;
}

function renderLogin(route: string) {
  const services = createTestServices();
  render(
    <AppProviders services={services}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  );
  return services;
}

async function submit(email: string, password: string) {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('Correo electrónico'), email);
  await user.type(screen.getByLabelText('Contraseña'), password);
  await user.click(screen.getByRole('button', { name: 'Ingresar' }));
}

describe('LoginPage', () => {
  it('muestra error con credenciales incorrectas y limpia la contraseña', async () => {
    renderLogin('/login');
    await submit(ADMIN_EMAIL, 'mala');
    expect(await screen.findByRole('alert')).toHaveTextContent('Correo o contraseña incorrectos.');
    expect(screen.getByLabelText('Contraseña')).toHaveValue('');
  });

  it('pide ambos campos antes de llamar al backend', async () => {
    renderLogin('/login');
    await userEvent.click(await screen.findByRole('button', { name: 'Ingresar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Escribe tu correo y tu contraseña.');
  });

  it('al entrar redirige a la ruta de "volver"', async () => {
    renderLogin('/login?volver=%2Faire');
    await submit(ADMIN_EMAIL, DEMO_PASSWORD);
    expect(await screen.findByText('Ruta actual: /aire')).toBeInTheDocument();
  });

  it('ignora un "volver" externo', async () => {
    renderLogin('/login?volver=%2F%2Fevil.com');
    await submit(ADMIN_EMAIL, DEMO_PASSWORD);
    expect(await screen.findByText('Ruta actual: /')).toBeInTheDocument();
  });

  it('ignora un "volver" con tabulación incrustada (/\\t/evil.com)', async () => {
    renderLogin('/login?volver=%2F%09%2Fevil.com');
    await submit(ADMIN_EMAIL, DEMO_PASSWORD);
    expect(await screen.findByText('Ruta actual: /')).toBeInTheDocument();
  });

  it('ignora un "volver" que al normalizar puntos queda como "//evil.com"', async () => {
    renderLogin('/login?volver=%2Fa%2F..%2F%2Fevil.com');
    await submit(ADMIN_EMAIL, DEMO_PASSWORD);
    expect(await screen.findByText('Ruta actual: /')).toBeInTheDocument();
  });
});
