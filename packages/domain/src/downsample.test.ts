import { describe, expect, it } from 'vitest';
import { downsampleSeries, lttb, minMaxDownsample, strategyForSensorType } from './downsample';
import type { SeriesPoint } from './series';

function flatWithSpike(n: number, spikeAt: number): SeriesPoint[] {
  return Array.from({ length: n }, (_, i): SeriesPoint => [i * 60_000, i === spikeAt ? 10 : Math.sin(i / 50) * 0.01]);
}

describe('lttb', () => {
  it('devuelve exactamente el umbral, conserva extremos y el pico', () => {
    const points = flatWithSpike(10_000, 4321);
    const out = lttb(points, 500);
    expect(out).toHaveLength(500);
    expect(out[0]).toEqual(points[0]);
    expect(out.at(-1)).toEqual(points.at(-1));
    expect(out.some((p) => p[1] === 10)).toBe(true);
  });
  it('si hay menos puntos que el umbral devuelve una copia', () => {
    const points = flatWithSpike(10, 3);
    const out = lttb(points, 500);
    expect(out).toEqual(points);
    expect(out).not.toBe(points);
  });
});

describe('minMaxDownsample', () => {
  it('conserva el pico, respeta el orden temporal y el límite de puntos', () => {
    const points = flatWithSpike(43_200, 20_000);
    const out = minMaxDownsample(points, 750);
    expect(out.length).toBeLessThanOrEqual(1500);
    expect(out.some((p) => p[1] === 10)).toBe(true);
    for (let i = 1; i < out.length; i++) expect(out[i]![0]).toBeGreaterThanOrEqual(out[i - 1]![0]);
  });
});

describe('downsampleSeries / strategyForSensorType', () => {
  it('acelerómetros usan min/max; el resto LTTB', () => {
    expect(strategyForSensorType('accelerometer')).toBe('minmax');
    expect(strategyForSensorType('crack_meter')).toBe('lttb');
  });
  it('reduce cada serie a ~1500 puntos y no toca las cortas', () => {
    const out = downsampleSeries({ long: flatWithSpike(43_200, 1), short: flatWithSpike(100, 1) }, 'lttb');
    expect(out.long).toHaveLength(1500);
    expect(out.short).toHaveLength(100);
  });
});
