import { ApiProvider } from '@gd/query';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { Services } from './services';
import { SessionProvider } from './session/SessionProvider';

export function AppProviders({ services, children }: { services: Services; children: ReactNode }) {
  return (
    <QueryClientProvider client={services.queryClient}>
      <ApiProvider api={services.api}>
        <SessionProvider manager={services.session}>{children}</SessionProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
}
