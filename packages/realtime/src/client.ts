import { alertAdminSchema, alertResidenteSchema, type AlertResidente, type Role, type Scheduler } from '@gd/api';
import { ioSocketFactory, type SocketFactory, type SocketLike, type SocketListener } from './socket';

export type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export interface RealtimeClient {
  start(): void;
  stop(): void;
  /** El access token cambió (refresh): reconectar para que el servidor vea el nuevo. */
  tokenChanged(): void;
  getStatus(): RealtimeStatus;
  onStatus(listener: (status: RealtimeStatus) => void): () => void;
  onAlert(listener: (alert: AlertResidente) => void): () => void;
}

export const ALERT_EVENT = 'alert:new';
/** Esperas entre reintentos cuando el servidor rechaza el handshake (p. ej. token vencido). */
export const AUTH_RETRY_DELAYS_MS = [0, 2_000, 10_000, 30_000] as const;

export interface RealtimeClientOptions {
  url: string;
  path?: string;
  role: Role;
  getAccessToken: () => string | null;
  refreshAccessToken: () => Promise<boolean>;
  socketFactory?: SocketFactory;
  scheduler?: Scheduler;
  onInvalidPayload?: (payload: unknown) => void;
}

const defaultScheduler: Scheduler = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export function createRealtimeClient(options: RealtimeClientOptions): RealtimeClient {
  const scheduler = options.scheduler ?? defaultScheduler;
  const schema = options.role === 'ADMIN' ? alertAdminSchema : alertResidenteSchema;
  const statusListeners = new Set<(status: RealtimeStatus) => void>();
  const alertListeners = new Set<(alert: AlertResidente) => void>();

  let status: RealtimeStatus = 'idle';
  let socket: SocketLike | null = null;
  let started = false;
  let authFailures = 0;
  let retryTimer: unknown = null;

  function setStatus(next: RealtimeStatus) {
    if (next === status) return;
    status = next;
    for (const listener of [...statusListeners]) listener(next);
  }

  function clearRetry() {
    if (retryTimer !== null) scheduler.clearTimeout(retryTimer);
    retryTimer = null;
  }

  const handleConnect: SocketListener = () => {
    authFailures = 0;
    setStatus('connected');
  };

  const handleDisconnect: SocketListener = (reason) => {
    if (!started || reason === 'io client disconnect') return; // desconexión pedida por nosotros
    setStatus(socket?.active ? 'reconnecting' : 'disconnected');
  };

  const handleConnectError: SocketListener = () => {
    if (!started || !socket) return;
    if (socket.active) {
      setStatus('reconnecting'); // error de transporte: socket.io reintenta solo
      return;
    }
    scheduleAuthRetry(); // rechazo del servidor: no hay reintento automático
  };

  const handleAlert: SocketListener = (payload) => {
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      options.onInvalidPayload?.(payload);
      return;
    }
    for (const listener of [...alertListeners]) listener(parsed.data);
  };

  function scheduleAuthRetry() {
    const delay = AUTH_RETRY_DELAYS_MS[authFailures];
    if (delay === undefined) {
      setStatus('disconnected');
      return;
    }
    authFailures += 1;
    setStatus('reconnecting');
    clearRetry();
    retryTimer = scheduler.setTimeout(() => {
      retryTimer = null;
      void options
        .refreshAccessToken()
        .catch(() => false)
        .then((renewed) => {
          if (!started || !socket) return;
          if (renewed || options.getAccessToken()) socket.connect();
          else setStatus('disconnected');
        });
    }, delay);
  }

  function ensureSocket(): SocketLike {
    if (socket) return socket;
    const created = (options.socketFactory ?? ioSocketFactory)({
      url: options.url,
      path: options.path ?? '/socket.io',
      getToken: options.getAccessToken,
    });
    created.on('connect', handleConnect);
    created.on('disconnect', handleDisconnect);
    created.on('connect_error', handleConnectError);
    created.on(ALERT_EVENT, handleAlert);
    socket = created;
    return created;
  }

  return {
    start() {
      if (started) return;
      started = true;
      if (!options.getAccessToken()) {
        setStatus('disconnected');
        return;
      }
      setStatus('connecting');
      ensureSocket().connect();
    },

    stop() {
      started = false;
      clearRetry();
      authFailures = 0;
      if (socket) {
        socket.off('connect', handleConnect);
        socket.off('disconnect', handleDisconnect);
        socket.off('connect_error', handleConnectError);
        socket.off(ALERT_EVENT, handleAlert);
        socket.disconnect();
        socket = null;
      }
      setStatus('idle');
    },

    tokenChanged() {
      if (!started || !options.getAccessToken()) return;
      clearRetry();
      // Solo se reinicia el contador si ya se agotaron los reintentos (p. ej. nuevo login). Un refresh
      // durante los reintentos también llama aquí: reiniciarlo anularía la espera y el tope.
      if (status === 'disconnected') authFailures = 0;
      const current = ensureSocket();
      // El token solo viaja en el handshake: hay que reconectar para que el servidor vea el nuevo.
      current.disconnect();
      if (status !== 'connected') setStatus('connecting');
      current.connect();
    },

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
