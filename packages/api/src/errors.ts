import { errorEnvelopeSchema } from './schemas/common';

export interface FieldError {
  path: string;
  message: string;
}

export interface ApiErrorInit {
  status: number;
  code: string;
  message: string;
  details?: unknown;
  retryAfterSeconds?: number | null;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;
  readonly retryAfterSeconds: number | null;

  constructor(init: ApiErrorInit) {
    super(init.message);
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code;
    this.details = init.details ?? null;
    this.retryAfterSeconds = init.retryAfterSeconds ?? null;
  }

  /** Errores por campo de un 422 VALIDATION_ERROR (`details: [{ path, message }]`). */
  get fieldErrors(): FieldError[] {
    if (!Array.isArray(this.details)) return [];
    return this.details.flatMap((detail: unknown) => {
      if (typeof detail !== 'object' || detail === null) return [];
      const { path, message } = detail as { path?: unknown; message?: unknown };
      if (typeof message !== 'string') return [];
      const joined = Array.isArray(path) ? path.map(String).join('.') : typeof path === 'string' ? path : '';
      return [{ path: joined, message }];
    });
  }
}

export interface ContractDrift {
  method: string;
  path: string;
  issues: string[];
}

export class ContractDriftError extends Error {
  readonly drift: ContractDrift;

  constructor(drift: ContractDrift) {
    super(`Respuesta fuera de contrato en ${drift.method} ${drift.path}`);
    this.name = 'ContractDriftError';
    this.drift = drift;
  }
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? Math.ceil(seconds) : null;
}

export async function apiErrorFromResponse(response: Response): Promise<ApiError> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  const retryAfterSeconds = parseRetryAfter(response.headers.get('Retry-After'));
  const parsed = errorEnvelopeSchema.safeParse(body);
  if (parsed.success) {
    return new ApiError({
      status: response.status,
      code: parsed.data.error.code,
      message: parsed.data.error.message,
      details: parsed.data.error.details ?? null,
      retryAfterSeconds,
    });
  }
  return new ApiError({
    status: response.status,
    code: `HTTP_${response.status}`,
    message: response.statusText || 'Error desconocido',
    retryAfterSeconds,
  });
}

export function networkError(cause: unknown): ApiError {
  return new ApiError({
    status: 0,
    code: 'NETWORK_ERROR',
    message: 'No se pudo conectar con el servidor',
    details: cause instanceof Error ? cause.message : null,
  });
}
