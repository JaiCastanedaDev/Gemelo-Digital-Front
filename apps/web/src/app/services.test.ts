import { ApiError, ContractDriftError } from '@gd/api';
import { describe, expect, it } from 'vitest';
import { describeInvalidPayload, shouldRetryQuery } from './services';

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

describe('describeInvalidPayload', () => {
  it('describe solo las claves de primer nivel, nunca los valores', () => {
    const text = describeInvalidPayload({ alert_id: 'a1', value_triggered: 0.0123, threshold: 0.01 });
    expect(text).toBe('payload fuera de contrato (claves: alert_id,value_triggered,threshold)');
    expect(text).not.toContain('0.0123');
  });
  it('indica cuando no es un objeto', () => {
    expect(describeInvalidPayload('secreto')).toBe('payload fuera de contrato (no es un objeto)');
    expect(describeInvalidPayload(null)).toBe('payload fuera de contrato (no es un objeto)');
    expect(describeInvalidPayload([1, 2])).toBe('payload fuera de contrato (no es un objeto)');
  });
});
