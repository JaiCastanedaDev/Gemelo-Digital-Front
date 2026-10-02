import { describe, expect, it } from 'vitest';
import { deductionLine, deductionText } from './healthCopy';

describe('deductionText', () => {
  it('usa singular y plural', () => {
    expect(deductionText({ reason: 'CRITICAL', count: 1, points: 25 })).toBe('1 alerta crítica');
    expect(deductionText({ reason: 'CRITICAL', count: 2, points: 50 })).toBe('2 alertas críticas');
    expect(deductionText({ reason: 'WARNING', count: 1, points: 10 })).toBe('1 advertencia');
    expect(deductionText({ reason: 'INFO', count: 2, points: 4 })).toBe('2 alertas informativas');
    expect(deductionText({ reason: 'OFFLINE', count: 1, points: 5 })).toBe('1 sensor sin datos');
  });
});

describe('deductionLine', () => {
  it('el administrador ve puntos y conteo', () => {
    expect(deductionLine({ reason: 'OFFLINE', count: 6, points: 30 }, true)).toBe('−30 · 6 sensores sin datos');
    expect(deductionLine({ reason: 'CRITICAL', count: 1, points: 25 }, true)).toBe('−25 · 1 alerta crítica');
  });

  it('el residente ve las alertas igual, pero los sensores sin cifras', () => {
    expect(deductionLine({ reason: 'OFFLINE', count: 6, points: 30 }, false)).toBe('sensores sin datos');
    expect(deductionLine({ reason: 'CRITICAL', count: 1, points: 25 }, false)).toBe('−25 · 1 alerta crítica');
  });
});
