import { StrictMode, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { AppProviders } from './app/AppProviders';
import { config } from './app/config';
import { AppRoutes } from './app/routes';
import { createServices, type RealtimeFactory } from './app/services';
import { SessionStorageTokenStore, getSessionStorage } from './app/session/SessionStorageTokenStore';
import './ui/tokens.css';

async function start() {
  let createRealtime: RealtimeFactory | undefined;
  let DevPanel: ComponentType | null = null;
  if (config.useMocks) {
    const { startMockWorker } = await import('./mocks/browser');
    await startMockWorker();
    ({ mockRealtimeFactory: createRealtime } = await import('./mocks/realtime'));
    const dev = await import('./mocks/DevPanel');
    if (dev.isDevPanelRequested()) DevPanel = dev.DevPanel;
  }
  const services = createServices({
    baseUrl: config.apiBaseUrl,
    store: new SessionStorageTokenStore(getSessionStorage()),
    validation: config.validation,
    onContractDrift: (drift) => console.warn('[contrato] respuesta fuera de contrato', drift),
    realtimeUrl: config.realtimeUrl,
    createRealtime,
  });
  const root = document.getElementById('root');
  if (!root) throw new Error('No se encontró #root');
  createRoot(root).render(
    <StrictMode>
      <BrowserRouter>
        <AppProviders services={services}>
          <AppRoutes />
        </AppProviders>
      </BrowserRouter>
      {DevPanel && <DevPanel />}
    </StrictMode>,
  );
}

void start();
