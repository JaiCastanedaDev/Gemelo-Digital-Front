import { describe, expect, it } from 'vitest';
import { compareAlertLevel, mostSevere, type AlertLevel } from './levels';

describe('mostSevere', () => {
  it('devuelve null si no hay niveles', () => {
    expect(mostSevere([])).toBeNull();
  });
  it('elige el nivel más severo', () => {
    expect(mostSevere(['INFO', 'CRITICAL', 'WARNING'])).toBe('CRITICAL');
    expect(mostSevere(['INFO', 'WARNING'])).toBe('WARNING');
  });
});

describe('compareAlertLevel', () => {
  it('ordena de más a menos severo', () => {
    const levels: AlertLevel[] = ['INFO', 'CRITICAL', 'WARNING'];
    expect(levels.sort(compareAlertLevel)).toEqual(['CRITICAL', 'WARNING', 'INFO']);
  });
});
