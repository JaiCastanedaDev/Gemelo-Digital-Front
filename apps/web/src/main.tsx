import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { AppProviders } from './app/AppProviders';
import { config } from './app/config';
import { AppRoutes } from './app/routes';
import { createServices } from './app/services';
import { SessionStorageTokenStore, getSessionStorage } from './app/session/SessionStorageTokenStore';
import './ui/tokens.css';

async function start() {
  if (config.useMocks) {
    const { startMockWorker } = await import('./mocks/browser');
    await startMockWorker();
  }
  const services = createServices({
    baseUrl: config.apiBaseUrl,
    store: new SessionStorageTokenStore(getSessionStorage()),
    validation: config.validation,
    onContractDrift: (drift) => console.warn('[contrato] respuesta fuera de contrato', drift),
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
    </StrictMode>,
  );
}

void start();
