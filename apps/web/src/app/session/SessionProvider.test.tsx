import { MemoryTokenStore } from '@gd/api';
import { QueryClient } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../../mocks/server';
import { createTestServices, loginAs } from '../../test/renderApp';
import { AppProviders } from '../AppProviders';
import { createServices } from '../services';
import { useSession } from './SessionProvider';

function Probe() {
  const { status, session } = useSession();
  return (
    <p>
      Estado: {status} / {session?.user?.email ?? 'sin sesión'}
    </p>
  );
}

describe('SessionProvider', () => {
  it('si ya hay sesión antes de montar, queda autenticado (restore no emite)', async () => {
    const services = createTestServices();
    await loginAs(services, 'admin');
    render(
      <AppProviders services={services}>
        <Probe />
      </AppProviders>,
    );
    expect(await screen.findByText('Estado: authenticated / admin@demo.co')).toBeInTheDocument();
  });

  it('sin sesión previa pasa de restoring a anonymous', async () => {
    render(
      <AppProviders services={createTestServices()}>
        <Probe />
      </AppProviders>,
    );
    expect(await screen.findByText('Estado: anonymous / sin sesión')).toBeInTheDocument();
  });

  it('si el refresh guardado devuelve un 200 malformado, termina anonymous (no se queda en restoring)', async () => {
    server.use(http.post('*/api/v1/auth/refresh', () => new HttpResponse('<html>no es JSON</html>', { status: 200 })));
    const store = new MemoryTokenStore();
    store.setRefreshToken('refresh-guardado');
    const services = createServices({
      baseUrl: 'http://localhost',
      store,
      validation: 'strict',
      queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
    });
    render(
      <AppProviders services={services}>
        <Probe />
      </AppProviders>,
    );
    expect(await screen.findByText('Estado: anonymous / sin sesión')).toBeInTheDocument();
    expect(store.getRefreshToken()).toBeNull();
  });

  it('si restore() rechaza por cualquier causa inesperada, termina anonymous', async () => {
    const base = createTestServices();
    const services = { ...base, session: { ...base.session, restore: () => Promise.reject(new Error('inesperado')) } };
    render(
      <AppProviders services={services}>
        <Probe />
      </AppProviders>,
    );
    expect(await screen.findByText('Estado: anonymous / sin sesión')).toBeInTheDocument();
  });
});
