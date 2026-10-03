import { parseTimestamp } from './time';
import type { TimeWindow } from './timeRange';

export type SeriesPoint = [number, number];
export type SeriesMap = Record<string, SeriesPoint[]>;

export interface ReadingLike {
  timestamp: string;
  values: Record<string, number | null>;
}

export function readingsToSeries(readings: readonly ReadingLike[], window?: TimeWindow): SeriesMap {
  const byKey = new Map<string, Map<number, number>>();
  for (const reading of readings) {
    const time = parseTimestamp(reading.timestamp)?.getTime();
    if (time === undefined) continue;
    if (window && (time < window.from || time > window.to)) continue;
    for (const [key, value] of Object.entries(reading.values)) {
      if (value === null || !Number.isFinite(value)) continue;
      let points = byKey.get(key);
      if (!points) {
        points = new Map();
        byKey.set(key, points);
      }
      points.set(time, value); // mismo instante repetido (borde de tramos): gana el último
    }
  }
  const series: SeriesMap = {};
  for (const [key, points] of byKey) {
    series[key] = [...points.entries()].sort((a, b) => a[0] - b[0]);
  }
  return series;
}

export function measuredChange(points: readonly SeriesPoint[]): number | null {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last || points.length < 2) return null;
  return last[1] - first[1];
}

export function countPoints(series: SeriesMap): number {
  return Object.values(series).reduce((total, points) => total + points.length, 0);
}
