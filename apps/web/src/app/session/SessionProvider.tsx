import type { Session, SessionManager } from '@gd/api';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export type SessionStatus = 'restoring' | 'authenticated' | 'anonymous' | 'expired';

interface SessionContextValue {
  status: SessionStatus;
  /** En 'expired' conserva la última sesión para seguir pintando la UI detrás del modal. */
  session: Session | null;
  login(email: string, password: string): Promise<Session>;
  logout(): Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

interface State {
  status: SessionStatus;
  session: Session | null;
}

export function SessionProvider({ manager, children }: { manager: SessionManager; children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<State>({ status: 'restoring', session: null });
  const lastSubRef = useRef<string | null>(null);

  useEffect(() => {
    const unsubscribe = manager.subscribe((next, reason) => {
      setState((prev) => {
        if (next) return { status: 'authenticated', session: next };
        if (reason === 'expired' && prev.session) return { status: 'expired', session: prev.session };
        return { status: 'anonymous', session: null };
      });
    });
    let cancelled = false;
    void manager.restore().then((restored) => {
      if (cancelled) return;
      if (restored) {
        // Si la sesión ya existía antes de montar, restore() la devuelve sin emitir.
        setState({ status: 'authenticated', session: restored });
        return;
      }
      setState((prev) => (prev.status === 'restoring' ? { status: 'anonymous', session: null } : prev));
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [manager]);

  useEffect(() => {
    if (state.status === 'authenticated' && state.session) lastSubRef.current = state.session.claims.sub;
  }, [state]);

  const login = useCallback(
    async (email: string, password: string) => {
      const previousSub = lastSubRef.current;
      const session = await manager.login(email, password);
      if (previousSub !== null && previousSub !== session.claims.sub) queryClient.clear();
      return session;
    },
    [manager, queryClient],
  );

  const logout = useCallback(async () => {
    await manager.logout();
    lastSubRef.current = null;
    queryClient.clear();
  }, [manager, queryClient]);

  const value = useMemo(() => ({ ...state, login, logout }), [state, login, logout]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession debe usarse dentro de <SessionProvider>');
  return value;
}
