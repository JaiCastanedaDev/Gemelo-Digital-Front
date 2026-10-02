import { parseTimestamp } from './time';

export function ageMs(iso: string | null | undefined, now: Date): number | null {
  const date = parseTimestamp(iso);
  return date ? now.getTime() - date.getTime() : null;
}

export function isStale(iso: string | null | undefined, now: Date, maxAgeMs: number): boolean {
  const age = ageMs(iso, now);
  return age === null || age > maxAgeMs;
}
