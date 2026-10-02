import {
  ApiError,
  ContractDriftError,
  createApi,
  createHttpClient,
  createSessionManager,
  type Api,
  type ContractDrift,
  type SessionManager,
  type TokenStore,
  type ValidationMode,
} from '@gd/api';
import { QueryClient } from '@tanstack/react-query';

export interface Services {
  session: SessionManager;
  api: Api;
  queryClient: QueryClient;
}

export interface ServicesOptions {
  baseUrl: string;
  store: TokenStore;
  validation: ValidationMode;
  onContractDrift?: (drift: ContractDrift) => void;
  queryClient?: QueryClient;
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
  return { session, api: createApi(http), queryClient: options.queryClient ?? defaultQueryClient() };
}
