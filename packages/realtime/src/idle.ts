import type { RealtimeClient } from './client';

/** Cliente sin tiempo real (configuración sin URL de socket): siempre 'idle'. */
export function createIdleRealtimeClient(): RealtimeClient {
  return {
    start() {},
    stop() {},
    tokenChanged() {},
    getStatus: () => 'idle',
    onStatus: () => () => {},
    onAlert: () => () => {},
  };
}
