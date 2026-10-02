import { ApiProvider } from '@gd/query';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { AlertSound } from '../features/realtime/alertSound';
import { RealtimeProvider } from '../features/realtime/RealtimeProvider';
import { ToastProvider } from '../ui/toast/ToastProvider';
import type { Services } from './services';
import { SessionProvider } from './session/SessionProvider';

interface AppProvidersProps {
  services: Services;
  sound?: AlertSound;
  children: ReactNode;
}

export function AppProviders({ services, sound, children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={services.queryClient}>
      <ApiProvider api={services.api}>
        <SessionProvider manager={services.session}>
          <ToastProvider>
            <RealtimeProvider createRealtime={services.createRealtime} sound={sound}>
              {children}
            </RealtimeProvider>
          </ToastProvider>
        </SessionProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
}
