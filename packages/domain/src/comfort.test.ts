import { describe, expect, it } from 'vitest';
import { COMFORT_TONE } from './comfort';

describe('COMFORT_TONE', () => {
  it('mapea el índice del backend a un estado visual', () => {
    expect(COMFORT_TONE).toEqual({ BUENO: 'OK', REGULAR: 'WARNING', MALO: 'CRITICAL' });
  });
});
