import {
  ApiError,
  ContractDriftError,
  createApi,
  createHttpClient,
  createSessionManager,
  type Api,
  type ContractDrift,
  type Role,
  type SessionManager,
  type TokenStore,
  type ValidationMode,
} from '@gd/api';
import { createIdleRealtimeClient, createRealtimeClient, type RealtimeClient } from '@gd/realtime';
import { QueryClient } from '@tanstack/react-query';

export interface RealtimeFactoryArgs {
  role: Role;
  getAccessToken: () => string | null;
  refreshAccessToken: () => Promise<boolean>;
}

export type RealtimeFactory = (args: RealtimeFactoryArgs) => RealtimeClient;

export interface Services {
  session: SessionManager;
  api: Api;
  queryClient: QueryClient;
  createRealtime(role: Role): RealtimeClient;
}

export interface ServicesOptions {
  baseUrl: string;
  store: TokenStore;
  validation: ValidationMode;
  onContractDrift?: (drift: ContractDrift) => void;
  queryClient?: QueryClient;
  /** Origen del servidor Socket.IO; sin URL ni factory no hay tiempo real. */
  realtimeUrl?: string;
  createRealtime?: RealtimeFactory;
}

// 429: la app ya muestra el mensaje de espera; reintentar solo martillaría una API con límite de tasa.
const NO_RETRY_STATUS = new Set([401, 403, 404, 422, 429]);

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (error instanceof ContractDriftError) return false;
  if (error instanceof ApiError && NO_RETRY_STATUS.has(error.status)) return false;
  return failureCount < 2;
}

function defaultQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10_000,
        retry: shouldRetryQuery,
      },
    },
  });
}

/**
 * Descripción segura de un payload de socket inválido: solo las claves de primer nivel.
 * Un payload de residente/administrador puede contener valores que no deben llegar a logs.
 */
export function describeInvalidPayload(payload: unknown): string {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return 'payload fuera de contrato (no es un objeto)';
  }
  return `payload fuera de contrato (claves: ${Object.keys(payload).join(',')})`;
}

function defaultRealtimeFactory(url: string | undefined, onInvalidPayload: (payload: unknown) => void): RealtimeFactory {
  if (!url) return () => createIdleRealtimeClient();
  return (args) => createRealtimeClient({ url, onInvalidPayload, ...args });
}

export function createServices(options: ServicesOptions): Services {
  const session = createSessionManager({ baseUrl: options.baseUrl, store: options.store });
  const http = createHttpClient({
    baseUrl: options.baseUrl,
    getAccessToken: () => session.getAccessToken(),
    refreshAccessToken: () => session.refresh(),
    waitForReauth: () => session.waitForReauth(),
    validation: options.validation,
    onContractDrift: options.onContractDrift,
  });
  const factory =
    options.createRealtime ??
    defaultRealtimeFactory(options.realtimeUrl, (payload) =>
      options.onContractDrift?.({ method: 'SOCKET', path: 'alert:new', issues: [describeInvalidPayload(payload)] }),
    );
  return {
    session,
    api: createApi(http),
    queryClient: options.queryClient ?? defaultQueryClient(),
    createRealtime: (role) =>
      factory({
        role,
        getAccessToken: () => session.getAccessToken(),
        refreshAccessToken: () => session.refresh(),
      }),
  };
}
