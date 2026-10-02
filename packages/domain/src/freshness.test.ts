import { describe, expect, it } from 'vitest';
import { ageMs, isStale } from './freshness';

const NOW = new Date('2026-10-02T15:00:00Z');

describe('freshness', () => {
  it('calcula la edad en ms', () => {
    expect(ageMs('2026-10-02T14:59:00Z', NOW)).toBe(60_000);
  });
  it('devuelve null para fechas inválidas', () => {
    expect(ageMs(null, NOW)).toBeNull();
    expect(ageMs('x', NOW)).toBeNull();
  });
  it('isStale compara contra el máximo permitido', () => {
    expect(isStale('2026-10-02T14:59:00Z', NOW, 60_000)).toBe(false);
    expect(isStale('2026-10-02T14:58:59Z', NOW, 60_000)).toBe(true);
  });
  it('un dato sin fecha válida siempre está desactualizado', () => {
    expect(isStale(null, NOW, 60_000)).toBe(true);
  });
});
