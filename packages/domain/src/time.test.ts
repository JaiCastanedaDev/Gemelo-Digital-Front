import { describe, expect, it } from 'vitest';
import { parseTimestamp } from './time';

describe('parseTimestamp', () => {
  it('un ISO sin zona horaria se interpreta como UTC', () => {
    expect(parseTimestamp('2026-10-02T10:00:00')?.toISOString()).toBe('2026-10-02T10:00:00.000Z');
    expect(parseTimestamp('2026-10-02T10:00')?.toISOString()).toBe('2026-10-02T10:00:00.000Z');
    expect(parseTimestamp('2026-10-02T10:00:00.250')?.toISOString()).toBe('2026-10-02T10:00:00.250Z');
  });
  it('con Z queda igual', () => {
    expect(parseTimestamp('2026-10-02T10:00:00Z')?.toISOString()).toBe('2026-10-02T10:00:00.000Z');
  });
  it('con desfase explícito respeta el desfase', () => {
    expect(parseTimestamp('2026-10-02T10:00:00+00:00')?.toISOString()).toBe('2026-10-02T10:00:00.000Z');
    expect(parseTimestamp('2026-10-02T10:00:00-05:00')?.toISOString()).toBe('2026-10-02T15:00:00.000Z');
  });
  it('una fecha sin hora sigue siendo UTC', () => {
    expect(parseTimestamp('2026-10-02')?.toISOString()).toBe('2026-10-02T00:00:00.000Z');
  });
  it('devuelve null para valores inválidos o ausentes', () => {
    expect(parseTimestamp('no-es-fecha')).toBeNull();
    expect(parseTimestamp('2026-13-45T99:99:99')).toBeNull();
    expect(parseTimestamp(null)).toBeNull();
    expect(parseTimestamp(undefined)).toBeNull();
    expect(parseTimestamp('')).toBeNull();
  });
});
