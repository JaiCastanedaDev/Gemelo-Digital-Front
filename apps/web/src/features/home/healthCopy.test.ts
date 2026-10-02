import { describe, expect, it } from 'vitest';
import { deductionText } from './healthCopy';

describe('deductionText', () => {
  it('usa singular y plural', () => {
    expect(deductionText({ reason: 'CRITICAL', count: 1, points: 25 })).toBe('1 alerta crítica');
    expect(deductionText({ reason: 'CRITICAL', count: 2, points: 50 })).toBe('2 alertas críticas');
    expect(deductionText({ reason: 'WARNING', count: 1, points: 10 })).toBe('1 advertencia');
    expect(deductionText({ reason: 'INFO', count: 2, points: 4 })).toBe('2 alertas informativas');
    expect(deductionText({ reason: 'OFFLINE', count: 1, points: 5 })).toBe('1 sensor sin datos');
  });
});
