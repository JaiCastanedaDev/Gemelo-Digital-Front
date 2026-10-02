import { z } from 'zod';
import { apiErrorFromResponse, networkError } from './errors';
import { API_PREFIX } from './http';
import { decodeJwtPayload } from './jwt';
import { loginResponseSchema, refreshResponseSchema, type SessionUser } from './schemas/auth';
import { idSchema, roleSchema, type Role } from './schemas/common';

export interface TokenStore {
  getRefreshToken(): string | null;
  setRefreshToken(token: string | null): void;
  getUser(): SessionUser | null;
  setUser(user: SessionUser | null): void;
}

export class MemoryTokenStore implements TokenStore {
  private refreshToken: string | null = null;
  private user: SessionUser | null = null;
  getRefreshToken() {
    return this.refreshToken;
  }
  setRefreshToken(token: string | null) {
    this.refreshToken = token;
  }
  getUser() {
    return this.user;
  }
  setUser(user: SessionUser | null) {
    this.user = user;
  }
}

export interface SessionClaims {
  sub: string;
  role: Role;
  buildingId: string;
}

export interface Session {
  accessToken: string;
  claims: SessionClaims;
  user: SessionUser | null;
}

export type SessionEndReason = 'logout' | 'expired';
export type SessionListener = (session: Session | null, reason?: SessionEndReason) => void;

export interface Scheduler {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export const REFRESH_MARGIN_SECONDS = 120;

/** Cuándo renovar: 120 s antes de expirar, o a la mitad de la vida si el token es más corto que 2× el margen. */
export function refreshDelayMs(expiresInSeconds: number): number {
  return expiresInSeconds > REFRESH_MARGIN_SECONDS * 2
    ? (expiresInSeconds - REFRESH_MARGIN_SECONDS) * 1000
    : (expiresInSeconds * 1000) / 2;
}

const claimsSchema = z.object({ sub: idSchema, role: roleSchema, buildingId: idSchema });

export function decodeClaims(accessToken: string): SessionClaims {
  return claimsSchema.parse(decodeJwtPayload(accessToken));
}

export interface SessionManagerOptions {
  baseUrl: string;
  store: TokenStore;
  fetch?: typeof fetch;
  scheduler?: Scheduler;
}

export interface SessionManager {
  getAccessToken(): string | null;
  getSession(): Session | null;
  login(email: string, password: string): Promise<Session>;
  restore(): Promise<Session | null>;
  refresh(): Promise<boolean>;
  waitForReauth(): Promise<boolean>;
  logout(): Promise<void>;
  subscribe(listener: SessionListener): () => void;
}

interface TokenPayload {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

const defaultScheduler: Scheduler = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export function createSessionManager(options: SessionManagerOptions): SessionManager {
  const doFetch: typeof fetch = options.fetch ?? ((input, init) => fetch(input, init));
  const scheduler = options.scheduler ?? defaultScheduler;
  const { store } = options;
  const listeners = new Set<SessionListener>();

  let session: Session | null = null;
  let lastSub: string | null = null;
  let expired = false;
  let timer: unknown = null;
  let inflight: Promise<boolean> | null = null;
  /** Generación de la sesión: cualquier respuesta de red que llegue de una generación anterior se descarta. */
  let epoch = 0;

  async function postJson(path: string, body: unknown, accessToken?: string): Promise<Response> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    try {
      return await doFetch(`${options.baseUrl}${API_PREFIX}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
    } catch (error) {
      throw networkError(error);
    }
  }

  function emit(reason?: SessionEndReason) {
    for (const listener of [...listeners]) listener(session, reason);
  }

  function cancelTimer() {
    if (timer !== null) scheduler.clearTimeout(timer);
    timer = null;
  }

  function apply(tokens: TokenPayload, user: SessionUser | null): Session {
    const claims = decodeClaims(tokens.access_token);
    store.setRefreshToken(tokens.refresh_token);
    if (user) store.setUser(user);
    session = { accessToken: tokens.access_token, claims, user: user ?? store.getUser() };
    lastSub = claims.sub;
    expired = false;
    cancelTimer();
    timer = scheduler.setTimeout(() => {
      void refresh();
    }, refreshDelayMs(tokens.expires_in));
    emit();
    return session;
  }

  function clear(reason: SessionEndReason) {
    epoch++;
    cancelTimer();
    expired = reason === 'expired' && session !== null;
    session = null;
    store.setRefreshToken(null);
    store.setUser(null);
    emit(reason);
  }

  async function doRefresh(): Promise<boolean> {
    const refreshToken = store.getRefreshToken();
    if (!refreshToken) {
      if (session) clear('expired');
      return false;
    }
    const startEpoch = epoch;
    const superseded = () => epoch !== startEpoch || store.getRefreshToken() !== refreshToken;
    let response: Response;
    try {
      response = await postJson('/auth/refresh', { refresh_token: refreshToken });
    } catch {
      return false; // red caída: se conserva la sesión y se reintenta en la próxima petición
    }
    if (superseded()) return false; // logout o nuevo login mientras volaba la petición
    if (response.status === 401 || response.status === 403) {
      clear('expired');
      return false;
    }
    if (!response.ok) return false;
    const data = refreshResponseSchema.parse(await response.json());
    if (superseded()) return false;
    apply(data, data.user ?? null);
    return true;
  }

  function refresh(): Promise<boolean> {
    if (inflight) return inflight;
    const current = doRefresh().finally(() => {
      if (inflight === current) inflight = null;
    });
    inflight = current;
    return current;
  }

  function subscribe(listener: SessionListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  return {
    getAccessToken: () => session?.accessToken ?? null,
    getSession: () => session,

    async login(email, password) {
      const startEpoch = ++epoch; // un login nuevo reemplaza cualquier refresh o login en vuelo
      const cancelled = () => new Error('Inicio de sesión cancelado: la sesión cambió mientras se esperaba la respuesta');
      const response = await postJson('/auth/login', { email, password });
      if (epoch !== startEpoch) throw cancelled();
      if (!response.ok) throw await apiErrorFromResponse(response);
      const data = loginResponseSchema.parse(await response.json());
      if (epoch !== startEpoch) throw cancelled();
      return apply(data, data.user);
    },

    async restore() {
      if (session) return session;
      const ok = await refresh();
      return ok ? session : null;
    },

    refresh,

    waitForReauth() {
      if (session) return Promise.resolve(true);
      if (!expired) return Promise.resolve(false);
      const expectedSub = lastSub;
      return new Promise<boolean>((resolve) => {
        const unsubscribe = subscribe((next, reason) => {
          if (next) {
            unsubscribe();
            resolve(next.claims.sub === expectedSub);
          } else if (reason === 'logout') {
            unsubscribe();
            resolve(false);
          }
        });
      });
    },

    async logout() {
      const refreshToken = store.getRefreshToken();
      const accessToken = session?.accessToken;
      clear('logout');
      if (!refreshToken) return;
      try {
        await postJson('/auth/logout', { refresh_token: refreshToken }, accessToken);
      } catch {
        // best-effort: la sesión local ya se cerró
      }
    },

    subscribe,
  };
}
