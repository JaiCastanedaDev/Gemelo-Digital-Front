import { setupWorker } from 'msw/browser';
import { db, resetDb } from './db';
import { handlers } from './handlers';
import { isScenario, type Scenario } from './seed';

declare global {
  interface Window {
    __gdMocks?: {
      expireAccessTokens(): void;
      revokeRefreshTokens(): void;
      reset(scenario?: Scenario): void;
    };
  }
}

const SCENARIO_KEY = 'gd.mock.escenario';

/** `?escenario=` en la URL tiene prioridad y se recuerda en la pestaña. */
function pickScenario(): Scenario {
  const fromUrl = new URLSearchParams(window.location.search).get('escenario');
  try {
    if (isScenario(fromUrl)) {
      window.sessionStorage.setItem(SCENARIO_KEY, fromUrl);
      return fromUrl;
    }
    const saved = window.sessionStorage.getItem(SCENARIO_KEY);
    return isScenario(saved) ? saved : 'sano';
  } catch {
    return isScenario(fromUrl) ? fromUrl : 'sano';
  }
}

export async function startMockWorker(): Promise<void> {
  resetDb(pickScenario());
  window.__gdMocks = {
    expireAccessTokens: () => {
      db.settings.accessValidAfterMs = Date.now() + 1;
    },
    revokeRefreshTokens: () => {
      db.settings.refreshValidAfterMs = Date.now() + 1;
    },
    reset: (scenario) => resetDb(scenario),
  };
  await setupWorker(...handlers).start({ onUnhandledRequest: 'bypass', quiet: true });
}
