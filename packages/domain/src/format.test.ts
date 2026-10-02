import { describe, expect, it } from 'vitest';
import { EMPTY_VALUE, formatDateTime, formatNumber, formatRelative, formatTime } from './format';

/** Intl usa espacios especiales (U+00A0, U+202F); se normalizan para comparar. */
const n = (s: string) => s.replace(/\s/g, ' ');
const NOW = new Date('2026-10-02T20:45:00Z');

describe('formatNumber', () => {
  it('usa punto de miles y coma decimal', () => {
    expect(n(formatNumber(12345.67))).toBe('12.345,7');
  });
  it('respeta los decimales pedidos', () => {
    expect(n(formatNumber(0.3456, 2))).toBe('0,35');
  });
  it('muestra guion para valores ausentes o no finitos', () => {
    expect(formatNumber(null)).toBe(EMPTY_VALUE);
    expect(formatNumber(undefined)).toBe(EMPTY_VALUE);
    expect(formatNumber(Number.NaN)).toBe(EMPTY_VALUE);
  });
});

describe('formatDateTime / formatTime', () => {
  it('convierte UTC a hora de Bogotá (UTC−5)', () => {
    expect(n(formatDateTime('2026-10-02T20:45:00Z'))).toMatch(/2 (de )?oct\.? (de )?2026,? 3:45 p\. ?m\./);
    expect(n(formatTime('2026-10-02T20:45:00Z'))).toMatch(/^3:45 p\. ?m\.$/);
  });
  it('cruza el día correctamente (UTC 03:00 = 10:00 p. m. del día anterior)', () => {
    expect(n(formatDateTime('2026-10-03T03:00:00Z'))).toMatch(/^2 (de )?oct/);
  });
  it('muestra guion para fechas inválidas', () => {
    expect(formatDateTime('x')).toBe(EMPTY_VALUE);
    expect(formatTime(null)).toBe(EMPTY_VALUE);
  });
});

describe('formatRelative', () => {
  it('"justo ahora" por debajo de un minuto o en el futuro', () => {
    expect(formatRelative('2026-10-02T20:44:30Z', NOW)).toBe('justo ahora');
    expect(formatRelative('2026-10-02T20:50:00Z', NOW)).toBe('justo ahora');
  });
  it('minutos, horas y días', () => {
    expect(n(formatRelative('2026-10-02T20:40:00Z', NOW))).toMatch(/^hace 5 min/);
    expect(n(formatRelative('2026-10-02T18:45:00Z', NOW))).toMatch(/^hace 2 h/);
    expect(n(formatRelative('2026-09-29T20:45:00Z', NOW))).toMatch(/^hace 3 d/);
  });
  it('guion para fechas inválidas', () => {
    expect(formatRelative(null, NOW)).toBe(EMPTY_VALUE);
  });
});
