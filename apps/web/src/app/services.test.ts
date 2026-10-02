import { ApiError, ContractDriftError } from '@gd/api';
import { describe, expect, it } from 'vitest';
import { shouldRetryQuery } from './services';

const apiError = (status: number) => new ApiError({ status, code: `HTTP_${status}`, message: 'x' });

describe('shouldRetryQuery', () => {
  it.each([401, 403, 404, 422, 429])('no reintenta un %i', (status) => {
    expect(shouldRetryQuery(0, apiError(status))).toBe(false);
  });
  it('no reintenta una deriva de contrato', () => {
    expect(shouldRetryQuery(0, new ContractDriftError({ method: 'GET', path: '/x', issues: [] }))).toBe(false);
  });
  it('reintenta hasta 2 veces los fallos transitorios (red, 5xx)', () => {
    expect(shouldRetryQuery(0, apiError(0))).toBe(true);
    expect(shouldRetryQuery(1, apiError(503))).toBe(true);
    expect(shouldRetryQuery(2, apiError(503))).toBe(false);
  });
});
