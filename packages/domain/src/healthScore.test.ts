import { describe, expect, it } from 'vitest';
import { clampScore, healthBand, scoreBreakdown } from './healthScore';

describe('scoreBreakdown', () => {
  it('lista solo lo que resta puntos, en orden de severidad', () => {
    expect(scoreBreakdown({ critical: 1, warning: 0, info: 2, offlineSensors: 2 })).toEqual([
      { reason: 'CRITICAL', count: 1, points: 25 },
      { reason: 'OFFLINE', count: 2, points: 10 },
      { reason: 'INFO', count: 2, points: 4 },
    ]);
  });
  it('devuelve lista vacía si no hay descuentos', () => {
    expect(scoreBreakdown({ critical: 0, warning: 0, info: 0, offlineSensors: 0 })).toEqual([]);
  });
});

describe('clampScore', () => {
  it('acota entre 0 y 100 y redondea', () => {
    expect(clampScore(-20)).toBe(0);
    expect(clampScore(140)).toBe(100);
    expect(clampScore(87.6)).toBe(88);
  });
  it('convierte NaN o infinito en 0', () => {
    expect(clampScore(Number.NaN)).toBe(0);
    expect(clampScore(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('healthBand', () => {
  it('usa las bandas por defecto 80/50', () => {
    expect(healthBand(80)).toBe('GOOD');
    expect(healthBand(79)).toBe('ATTENTION');
    expect(healthBand(50)).toBe('ATTENTION');
    expect(healthBand(49)).toBe('PRIORITY');
  });
  it('acepta bandas configurables', () => {
    expect(healthBand(85, { good: 90, attention: 60 })).toBe('ATTENTION');
  });
  it('un puntaje inválido cae en PRIORITY', () => {
    expect(healthBand(Number.NaN)).toBe('PRIORITY');
  });
});
