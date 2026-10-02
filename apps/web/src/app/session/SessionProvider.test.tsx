import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createTestServices, loginAs } from '../../test/renderApp';
import { AppProviders } from '../AppProviders';
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
});
