import { MemoryTokenStore } from '@gd/api';
import { QueryClient } from '@tanstack/react-query';
import { createServices, type Services } from '../app/services';
import { ADMIN_EMAIL, DEMO_PASSWORD, RESIDENTE_EMAIL } from '../mocks/seed';

export function createTestServices(): Services {
  return createServices({
    baseUrl: 'http://localhost',
    store: new MemoryTokenStore(),
    validation: 'strict',
    queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  });
}

export async function loginAs(services: Services, who: 'admin' | 'residente'): Promise<void> {
  await services.session.login(who === 'admin' ? ADMIN_EMAIL : RESIDENTE_EMAIL, DEMO_PASSWORD);
}
