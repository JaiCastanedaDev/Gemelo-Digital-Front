import { MemoryTokenStore } from '@gd/api';
import { QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AppProviders } from '../app/AppProviders';
import { AppRoutes } from '../app/routes';
import { createServices, type Services, type ServicesOptions } from '../app/services';
import type { AlertSound } from '../features/realtime/alertSound';
import { mockRealtimeFactory } from '../mocks/realtime';
import { ADMIN_EMAIL, DEMO_PASSWORD, RESIDENTE_EMAIL } from '../mocks/seed';

export function createTestServices(overrides: Partial<ServicesOptions> = {}): Services {
  return createServices({
    baseUrl: 'http://localhost',
    store: new MemoryTokenStore(),
    validation: 'strict',
    queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
    createRealtime: mockRealtimeFactory,
    ...overrides,
  });
}

export async function loginAs(services: Services, who: 'admin' | 'residente'): Promise<void> {
  await services.session.login(who === 'admin' ? ADMIN_EMAIL : RESIDENTE_EMAIL, DEMO_PASSWORD);
}

/** Por defecto el sonido es inerte en tests (jsdom no tiene Web Audio). */
const silentSound: AlertSound = { play: async () => 'unsupported', unlock: async () => false };

export function renderApp(services: Services, route = '/', options: { sound?: AlertSound } = {}) {
  return render(
    <AppProviders services={services} sound={options.sound ?? silentSound}>
      <MemoryRouter initialEntries={[route]}>
        <AppRoutes />
      </MemoryRouter>
    </AppProviders>,
  );
}
