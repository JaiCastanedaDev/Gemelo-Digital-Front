import type { StatusLevel } from './levels';
import type { SensorStatus } from './sensorStatus';

/** Orden de los estados en la densidad: los que piden atención primero. */
export const STATUS_ORDER: readonly StatusLevel[] = ['CRITICAL', 'WARNING', 'OFFLINE', 'INFO', 'OK'];

export interface ZoneDensity {
  zone: string;
  total: number;
  counts: Record<StatusLevel, number>;
}

export function densityByZone(statuses: Iterable<SensorStatus>): ZoneDensity[] {
  const zones = new Map<string, ZoneDensity>();
  for (const status of statuses) {
    let zone = zones.get(status.zone);
    if (!zone) {
      zone = { zone: status.zone, total: 0, counts: { CRITICAL: 0, WARNING: 0, INFO: 0, OK: 0, OFFLINE: 0 } };
      zones.set(status.zone, zone);
    }
    zone.total += 1;
    zone.counts[status.level] += 1;
  }
  return [...zones.values()].sort((a, b) => a.zone.localeCompare(b.zone, 'es'));
}
