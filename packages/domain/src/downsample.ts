import type { SeriesMap, SeriesPoint } from './series';

/** Puntos por serie que se dibujan (spec §9.2). */
export const TARGET_POINTS = 1500;
/** Por encima de este número de lecturas por rango se ofrece un rango menor. */
export const MAX_READINGS_PER_RANGE = 200_000;

export type DownsampleStrategy = 'lttb' | 'minmax';

/** Las aceleraciones conservan picos con min/max; el resto usa LTTB. */
export function strategyForSensorType(sensorType: string): DownsampleStrategy {
  return sensorType === 'accelerometer' ? 'minmax' : 'lttb';
}

/** Largest-Triangle-Three-Buckets: conserva la forma visual con `threshold` puntos. */
export function lttb(points: readonly SeriesPoint[], threshold: number): SeriesPoint[] {
  const n = points.length;
  if (threshold >= n || threshold < 3) return points.slice();
  const sampled: SeriesPoint[] = [points[0]!];
  const every = (n - 2) / (threshold - 2);
  let anchor = 0;
  for (let i = 0; i < threshold - 2; i++) {
    const avgStart = Math.floor((i + 1) * every) + 1;
    const avgEnd = Math.min(Math.floor((i + 2) * every) + 1, n);
    let avgX = 0;
    let avgY = 0;
    for (let j = avgStart; j < avgEnd; j++) {
      avgX += points[j]![0];
      avgY += points[j]![1];
    }
    const avgLength = Math.max(avgEnd - avgStart, 1);
    avgX /= avgLength;
    avgY /= avgLength;

    const rangeStart = Math.floor(i * every) + 1;
    const rangeEnd = Math.floor((i + 1) * every) + 1;
    const [ax, ay] = points[anchor]!;
    let maxArea = -1;
    let next = rangeStart;
    for (let j = rangeStart; j < rangeEnd; j++) {
      const [px, py] = points[j]!;
      const area = Math.abs((ax - avgX) * (py - ay) - (ax - px) * (avgY - ay));
      if (area > maxArea) {
        maxArea = area;
        next = j;
      }
    }
    sampled.push(points[next]!);
    anchor = next;
  }
  sampled.push(points[n - 1]!);
  return sampled;
}

/** Por cada cubeta de tiempo conserva el mínimo y el máximo (en orden temporal). */
export function minMaxDownsample(points: readonly SeriesPoint[], buckets: number): SeriesPoint[] {
  if (buckets < 1 || points.length <= buckets * 2) return points.slice();
  const first = points[0]![0];
  const last = points[points.length - 1]![0];
  const span = Math.max((last - first) / buckets, 1);
  const out: SeriesPoint[] = [];
  let index = 0;
  for (let bucket = 0; bucket < buckets; bucket++) {
    const end = bucket === buckets - 1 ? Number.POSITIVE_INFINITY : first + span * (bucket + 1);
    let min: SeriesPoint | null = null;
    let max: SeriesPoint | null = null;
    while (index < points.length && points[index]![0] < end) {
      const point = points[index]!;
      if (!min || point[1] < min[1]) min = point;
      if (!max || point[1] > max[1]) max = point;
      index++;
    }
    if (!min || !max) continue;
    if (min === max) out.push(min);
    else if (min[0] <= max[0]) out.push(min, max);
    else out.push(max, min);
  }
  return out;
}

export function downsampleSeries(series: SeriesMap, strategy: DownsampleStrategy, target: number = TARGET_POINTS): SeriesMap {
  const out: SeriesMap = {};
  for (const [key, points] of Object.entries(series)) {
    out[key] = strategy === 'minmax' ? minMaxDownsample(points, Math.floor(target / 2)) : lttb(points, target);
  }
  return out;
}
