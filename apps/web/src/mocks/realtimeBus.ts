import type { AlertAdmin } from '@gd/api';
import type { RealtimeStatus } from '@gd/realtime';

type AlertListener = (alert: AlertAdmin) => void;
type StatusListener = (status: RealtimeStatus) => void;

const alertListeners = new Set<AlertListener>();
const statusListeners = new Set<StatusListener>();
let status: RealtimeStatus = 'connected';

/** "Servidor" de tiempo real simulado: los clientes simulados se suscriben aquí. */
export const realtimeBus = {
  publishAlert(alert: AlertAdmin) {
    for (const listener of [...alertListeners]) listener(alert);
  },
  setStatus(next: RealtimeStatus) {
    status = next;
    for (const listener of [...statusListeners]) listener(next);
  },
  getStatus: (): RealtimeStatus => status,
  subscribeAlerts(listener: AlertListener): () => void {
    alertListeners.add(listener);
    return () => {
      alertListeners.delete(listener);
    };
  },
  subscribeStatus(listener: StatusListener): () => void {
    statusListeners.add(listener);
    return () => {
      statusListeners.delete(listener);
    };
  },
  reset() {
    status = 'connected';
    alertListeners.clear();
    statusListeners.clear();
  },
};
