import type { z } from 'zod';
import { ApiError, ContractDriftError, apiErrorFromResponse, networkError, type ContractDrift } from './errors';

export const API_PREFIX = '/api/v1';

export type ValidationMode = 'strict' | 'lenient';
export type QueryParams = Record<string, string | number | boolean | null | undefined>;

export interface HttpClientOptions {
  /** Origen del backend; '' para rutas relativas (modo mock en el navegador). */
  baseUrl: string;
  getAccessToken: () => string | null;
  refreshAccessToken: () => Promise<boolean>;
  /** Se usa si el refresh falla: resuelve true cuando el mismo usuario vuelve a iniciar sesión. */
  waitForReauth?: () => Promise<boolean>;
  validation: ValidationMode;
  onContractDrift?: (drift: ContractDrift) => void;
  fetch?: typeof fetch;
}

export interface GetOptions<S extends z.ZodType> {
  schema: S;
  query?: QueryParams;
  signal?: AbortSignal;
}

export interface PostOptions<S extends z.ZodType> extends GetOptions<S> {
  body?: unknown;
}

export interface HttpClient {
  get<S extends z.ZodType>(path: string, options: GetOptions<S>): Promise<z.output<S>>;
  post<S extends z.ZodType>(path: string, options: PostOptions<S>): Promise<z.output<S>>;
  getBlob(path: string, options?: { query?: QueryParams; signal?: AbortSignal }): Promise<Blob>;
}

export function buildUrl(baseUrl: string, path: string, query?: QueryParams): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const search = params.toString();
  return `${baseUrl}${API_PREFIX}${path}${search ? `?${search}` : ''}`;
}

interface SendInit {
  method: 'GET' | 'POST';
  accept: string;
  query?: QueryParams;
  body?: unknown;
  signal?: AbortSignal;
}

function isAbortError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'AbortError';
}

export function createHttpClient(options: HttpClientOptions): HttpClient {
  const doFetch: typeof fetch = options.fetch ?? ((input, init) => fetch(input, init));

  async function send(path: string, init: SendInit, retried = false): Promise<Response> {
    const headers: Record<string, string> = { Accept: init.accept };
    const token = options.getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    let body: string | undefined;
    if (init.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(init.body);
    }

    let response: Response;
    try {
      response = await doFetch(buildUrl(options.baseUrl, path, init.query), {
        method: init.method,
        headers,
        body,
        signal: init.signal,
      });
    } catch (error) {
      if (isAbortError(error)) throw error;
      throw networkError(error);
    }

    if (response.status === 401 && !retried) {
      let renewed = await options.refreshAccessToken();
      if (!renewed && options.waitForReauth) renewed = await options.waitForReauth();
      if (renewed) return send(path, init, true);
    }
    if (!response.ok) throw await apiErrorFromResponse(response);
    return response;
  }

  async function parse<S extends z.ZodType>(
    response: Response,
    schema: S,
    method: string,
    path: string,
  ): Promise<z.output<S>> {
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new ApiError({
        status: response.status,
        code: 'INVALID_JSON',
        message: 'La respuesta del servidor no es JSON válido',
      });
    }
    // Regla: una respuesta que no pasa el esquema NUNCA se entrega cruda, en ningún modo. Se reporta la deriva
    // y se lanza ContractDriftError (la sección se degrada a "formato inesperado"). Los esquemas por rol deben
    // aplicarse siempre: la garantía de que el residente no recibe campos de más depende de este parseo.
    // 'lenient' solo afecta a cómo la app presenta la deriva; los campos extra desconocidos no fallan (z.object los descarta).
    const result = schema.safeParse(data);
    if (result.success) return result.data;
    const drift: ContractDrift = {
      method,
      path,
      issues: result.error.issues.map((issue) => `${issue.path.map(String).join('.') || '(raíz)'}: ${issue.message}`),
    };
    options.onContractDrift?.(drift);
    throw new ContractDriftError(drift);
  }

  return {
    async get(path, { schema, query, signal }) {
      const response = await send(path, { method: 'GET', accept: 'application/json', query, signal });
      return parse(response, schema, 'GET', path);
    },
    async post(path, { schema, query, signal, body }) {
      const response = await send(path, { method: 'POST', accept: 'application/json', query, signal, body });
      return parse(response, schema, 'POST', path);
    },
    async getBlob(path, blobOptions = {}) {
      const response = await send(path, {
        method: 'GET',
        accept: '*/*',
        query: blobOptions.query,
        signal: blobOptions.signal,
      });
      return response.blob();
    },
  };
}
