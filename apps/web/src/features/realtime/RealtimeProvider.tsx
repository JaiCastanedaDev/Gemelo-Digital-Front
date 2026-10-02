import type { AlertResidente, Role } from '@gd/api';
import { applyAlertToCache, queryKeys } from '@gd/query';
import type { RealtimeClient, RealtimeStatus } from '@gd/realtime';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSession } from '../../app/session/SessionProvider';
import { useToasts } from '../../ui/toast/ToastProvider';
import { createAlertSound, type AlertSound } from './alertSound';
import { alertToast } from './alertToast';
import { useTitleBadge } from './titleBadge';

interface RealtimeContextValue {
  status: RealtimeStatus;
  soundBlocked: boolean;
  enableSound(): Promise<void>;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

interface RealtimeProviderProps {
  createRealtime: (role: Role) => RealtimeClient;
  sound?: AlertSound;
  children: ReactNode;
}

export function RealtimeProvider({ createRealtime, sound, children }: RealtimeProviderProps) {
  const { status: sessionStatus, session } = useSession();
  const queryClient = useQueryClient();
  const { show } = useToasts();
  const notifyTitle = useTitleBadge();
  const [alertSound] = useState<AlertSound>(() => sound ?? createAlertSound());
  const [status, setStatus] = useState<RealtimeStatus>('idle');
  const [soundBlocked, setSoundBlocked] = useState(false);

  const authenticated = sessionStatus === 'authenticated' && session !== null;
  const role = authenticated ? session.claims.role : null;
  const sub = authenticated ? session.claims.sub : null;
  const accessToken = authenticated ? session.accessToken : null;

  const clientRef = useRef<RealtimeClient | null>(null);
  const accessTokenRef = useRef<string | null>(accessToken);
  const tokenAtStartRef = useRef<string | null>(null);

  const handleAlert = useCallback(
    (alert: AlertResidente) => {
      if (!role) return;
      applyAlertToCache(queryClient, role, alert);
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.general() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sensors.list() });
      if (alert.level === 'INFO') return; // el backend no las emite; si llegan, solo se cachean
      show(alertToast(alert));
      notifyTitle(alert.level);
      if (alert.level === 'CRITICAL') {
        void alertSound.play().then((result) => setSoundBlocked(result === 'blocked'));
      }
    },
    [role, queryClient, show, notifyTitle, alertSound],
  );
  const handleAlertRef = useRef(handleAlert);

  useEffect(() => {
    handleAlertRef.current = handleAlert;
  }, [handleAlert]);

  useEffect(() => {
    accessTokenRef.current = accessToken;
  }, [accessToken]);

  // Un cliente por usuario y rol mientras la sesión está activa.
  useEffect(() => {
    if (!role || !sub) return;
    const client = createRealtime(role);
    clientRef.current = client;
    tokenAtStartRef.current = accessTokenRef.current;
    let hasConnected = false;
    const offStatus = client.onStatus((next) => {
      setStatus(next);
      if (next !== 'connected') return;
      if (hasConnected) {
        // Reconexión: recuperar lo que pudo llegar mientras no había socket.
        void queryClient.invalidateQueries({ queryKey: queryKeys.alerts.all() });
        void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.general() });
      }
      hasConnected = true;
    });
    const offAlert = client.onAlert((alert) => handleAlertRef.current(alert));
    client.start();
    return () => {
      offStatus();
      offAlert();
      client.stop();
      clientRef.current = null;
      setStatus('idle');
    };
  }, [role, sub, createRealtime, queryClient]);

  // Mismo usuario con token renovado: reconectar para que el servidor vea el nuevo.
  useEffect(() => {
    if (!accessToken || !clientRef.current || accessToken === tokenAtStartRef.current) return;
    tokenAtStartRef.current = accessToken;
    clientRef.current.tokenChanged();
    // El estado del socket sigue en 'connected' durante este reinicio, así que la recarga por
    // reconexión no se dispara: una alerta emitida durante el handshake se perdería sin esto.
    void queryClient.invalidateQueries({ queryKey: queryKeys.alerts.all() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.general() });
  }, [accessToken, queryClient]);

  const enableSound = useCallback(async () => {
    const unlocked = await alertSound.unlock();
    setSoundBlocked(!unlocked);
  }, [alertSound]);

  const value = useMemo(() => ({ status, soundBlocked, enableSound }), [status, soundBlocked, enableSound]);
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime(): RealtimeContextValue {
  const value = useContext(RealtimeContext);
  if (!value) throw new Error('useRealtime debe usarse dentro de <RealtimeProvider>');
  return value;
}
