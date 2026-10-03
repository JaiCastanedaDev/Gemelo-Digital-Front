import { describe, expect, it } from 'vitest';
import {
  DAY_MS,
  bogotaDateRange,
  bogotaDayStart,
  dailyChunks,
  isRangeKey,
  rangeWindow,
  shorterRange,
} from './timeRange';

const NOW = Date.parse('2026-10-02T15:00:00Z');

describe('rangos', () => {
  it('valida las claves', () => {
    expect(isRangeKey('7d')).toBe(true);
    expect(isRangeKey('2h')).toBe(false);
    expect(isRangeKey(null)).toBe(false);
  });
  it('el rango menor de 30d es 7d y 1h no tiene menor', () => {
    expect(shorterRange('30d')).toBe('7d');
    expect(shorterRange('1h')).toBeNull();
  });
  it('la ventana termina ahora', () => {
    expect(rangeWindow('24h', NOW)).toEqual({ from: NOW - DAY_MS, to: NOW });
  });
});

describe('dailyChunks', () => {
  it('24 h que cruzan la medianoche UTC usan dos días; el de hoy queda abierto', () => {
    expect(dailyChunks(rangeWindow('24h', NOW), NOW)).toEqual([
      { desde: '2026-10-01T00:00:00.000Z', hasta: '2026-10-02T00:00:00.000Z', closed: true },
      { desde: '2026-10-02T00:00:00.000Z', hasta: '2026-10-03T00:00:00.000Z', closed: false },
    ]);
  });
  it('1 h dentro del día usa un solo tramo', () => {
    expect(dailyChunks(rangeWindow('1h', NOW), NOW)).toHaveLength(1);
  });
  it('7 días usan 8 tramos y las claves no cambian dentro del mismo día', () => {
    const first = dailyChunks(rangeWindow('7d', NOW), NOW);
    const later = dailyChunks(rangeWindow('7d', NOW + 3_600_000), NOW + 3_600_000);
    expect(first).toHaveLength(8);
    expect(later.map((c) => c.desde)).toEqual(first.map((c) => c.desde));
  });
});

describe('fechas de Bogotá', () => {
  it('el inicio del día en Bogotá es a las 05:00Z', () => {
    expect(bogotaDayStart('2026-10-02')).toBe(Date.parse('2026-10-02T05:00:00Z'));
  });
  it('rechaza fechas inválidas', () => {
    expect(bogotaDayStart('2026-02-30')).toBeNull();
    expect(bogotaDayStart('02/10/2026')).toBeNull();
    expect(bogotaDayStart('2026-10-2')).toBeNull();
  });
  it('el rango incluye todo el día "hasta"', () => {
    expect(bogotaDateRange('2026-10-01', '2026-10-02')).toEqual({
      from: Date.parse('2026-10-01T05:00:00Z'),
      to: Date.parse('2026-10-03T05:00:00Z'),
    });
    expect(bogotaDateRange(undefined, 'basura')).toEqual({ from: null, to: null });
  });
});
