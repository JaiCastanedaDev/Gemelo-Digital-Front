import type { AlertResidente, Role } from '@gd/api';
import type { RealtimeClient, RealtimeStatus } from '@gd/realtime';
import { realtimeBus } from './realtimeBus';
import { toResidenteAlert } from './serialize';

/** Implementación de RealtimeClient alimentada por el bus del backend simulado. */
export function createMockRealtimeClient(role: Role): RealtimeClient {
  const statusListeners = new Set<(status: RealtimeStatus) => void>();
  const alertListeners = new Set<(alert: AlertResidente) => void>();
  let status: RealtimeStatus = 'idle';
  let unsubscribe: (() => void) | null = null;

  function setStatus(next: RealtimeStatus) {
    if (next === status) return;
    status = next;
    for (const listener of [...statusListeners]) listener(next);
  }

  return {
    start() {
      if (unsubscribe) return;
      const offAlerts = realtimeBus.subscribeAlerts((alert) => {
        const shaped = role === 'ADMIN' ? { ...alert } : toResidenteAlert(alert);
        for (const listener of [...alertListeners]) listener(shaped);
      });
      const offStatus = realtimeBus.subscribeStatus(setStatus);
      unsubscribe = () => {
        offAlerts();
        offStatus();
      };
      setStatus(realtimeBus.getStatus());
    },
    stop() {
      unsubscribe?.();
      unsubscribe = null;
      setStatus('idle');
    },
    tokenChanged() {},
    getStatus: () => status,
    onStatus(listener) {
      statusListeners.add(listener);
      return () => {
        statusListeners.delete(listener);
      };
    },
    onAlert(listener) {
      alertListeners.add(listener);
      return () => {
        alertListeners.delete(listener);
      };
    },
  };
}
