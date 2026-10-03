import '@testing-library/jest-dom/vitest';
import { onlineManager } from '@tanstack/react-query';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { resetDb } from '../mocks/db';
import { realtimeBus } from '../mocks/realtimeBus';
import { server } from '../mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  // El onlineManager de TanStack es global: un test que dispara `offline` no debe contagiar a los siguientes.
  onlineManager.setOnline(true);
  server.resetHandlers();
  resetDb();
  realtimeBus.reset();
  window.sessionStorage.clear();
});
afterAll(() => server.close());
