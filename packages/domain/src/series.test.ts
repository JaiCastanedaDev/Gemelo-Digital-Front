import { describe, expect, it } from 'vitest';
import { countPoints, measuredChange, readingsToSeries } from './series';

const r = (timestamp: string, values: Record<string, number | null>) => ({ timestamp, values });

describe('readingsToSeries', () => {
  it('agrupa por clave, ordena, descarta nulos y fechas inválidas', () => {
    const series = readingsToSeries([
      r('2026-10-02T10:02:00Z', { x: 2, y: null }),
      r('no-es-fecha', { x: 99 }),
      r('2026-10-02T10:01:00Z', { x: 1, y: 5 }),
      r('2026-10-02T10:03:00Z', { x: Number.NaN, y: 6 }),
    ]);
    expect(series.x).toEqual([
      [Date.parse('2026-10-02T10:01:00Z'), 1],
      [Date.parse('2026-10-02T10:02:00Z'), 2],
    ]);
    expect(series.y?.map((p) => p[1])).toEqual([5, 6]);
  });

  it('una lectura repetida en el borde de dos tramos no se duplica (gana la última)', () => {
    const series = readingsToSeries([r('2026-10-02T00:00:00Z', { x: 1 }), r('2026-10-02T00:00:00Z', { x: 3 })]);
    expect(series.x).toEqual([[Date.parse('2026-10-02T00:00:00Z'), 3]]);
  });

  it('recorta a la ventana', () => {
    const window = { from: Date.parse('2026-10-02T10:00:00Z'), to: Date.parse('2026-10-02T11:00:00Z') };
    const series = readingsToSeries([r('2026-10-02T09:59:00Z', { x: 1 }), r('2026-10-02T10:30:00Z', { x: 2 })], window);
    expect(series.x?.map((p) => p[1])).toEqual([2]);
  });
});

describe('measuredChange / countPoints', () => {
  it('último menos primero', () => {
    expect(measuredChange([[1, 0.4], [2, 0.5], [3, 0.7]])).toBeCloseTo(0.3);
    expect(measuredChange([[1, 0.4]])).toBeNull();
  });
  it('cuenta todos los puntos', () => {
    expect(countPoints({ a: [[1, 1]], b: [[1, 1], [2, 2]] })).toBe(3);
  });
});
