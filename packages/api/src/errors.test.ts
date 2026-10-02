import { describe, expect, it } from 'vitest';
import { ApiError, apiErrorFromResponse, networkError } from './errors';

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

describe('apiErrorFromResponse', () => {
  it('lee el sobre { error: { code, message, details } }', async () => {
    const err = await apiErrorFromResponse(
      json(422, {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Datos inválidos',
          details: [{ path: ['description'], message: 'Mínimo 3 caracteres' }],
        },
      }),
    );
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(422);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.fieldErrors).toEqual([{ path: 'description', message: 'Mínimo 3 caracteres' }]);
  });

  it('lee Retry-After en segundos', async () => {
    const err = await apiErrorFromResponse(
      json(429, { error: { code: 'RATE_LIMITED', message: 'Demasiadas solicitudes' } }, { 'Retry-After': '30' }),
    );
    expect(err.retryAfterSeconds).toBe(30);
  });

  it('tolera cuerpos que no siguen el contrato', async () => {
    const err = await apiErrorFromResponse(new Response('<html>', { status: 502, statusText: 'Bad Gateway' }));
    expect(err.code).toBe('HTTP_502');
    expect(err.fieldErrors).toEqual([]);
  });
});

describe('networkError', () => {
  it('usa status 0 y NETWORK_ERROR', () => {
    const err = networkError(new TypeError('Failed to fetch'));
    expect(err.status).toBe(0);
    expect(err.code).toBe('NETWORK_ERROR');
  });
});
