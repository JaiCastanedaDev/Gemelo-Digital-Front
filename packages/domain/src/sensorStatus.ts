import { mostSevere, type AlertLevel, type SensorCategory, type StatusLevel } from './levels';
import { parseTimestamp } from './time';

export const OFFLINE_THRESHOLD_MS = 15 * 60 * 1000;

export interface SensorInput {
  sensor_id: string;
  zone: string;
  category: SensorCategory;
  last_seen_at: string | null;
}

export interface AlertInput {
  sensor_id: string;
  level: AlertLevel;
  acknowledged: boolean;
}

export interface SensorStatus {
  sensorId: string;
  level: StatusLevel;
  lastSeenAt: Date | null;
  zone: string;
  category: SensorCategory;
}

export function isOffline(lastSeenAt: string | null, now: Date): boolean {
  const seen = parseTimestamp(lastSeenAt);
  if (seen === null) return true;
  return now.getTime() - seen.getTime() > OFFLINE_THRESHOLD_MS;
}

export function buildSensorStatusMap(
  sensors: readonly SensorInput[],
  alerts: readonly AlertInput[],
  now: Date,
): Map<string, SensorStatus> {
  const openLevels = new Map<string, AlertLevel[]>();
  for (const alert of alerts) {
    if (alert.acknowledged) continue;
    const levels = openLevels.get(alert.sensor_id) ?? [];
    levels.push(alert.level);
    openLevels.set(alert.sensor_id, levels);
  }

  const result = new Map<string, SensorStatus>();
  for (const sensor of sensors) {
    const level: StatusLevel = isOffline(sensor.last_seen_at, now)
      ? 'OFFLINE'
      : (mostSevere(openLevels.get(sensor.sensor_id) ?? []) ?? 'OK');
    result.set(sensor.sensor_id, {
      sensorId: sensor.sensor_id,
      level,
      lastSeenAt: parseTimestamp(sensor.last_seen_at),
      zone: sensor.zone,
      category: sensor.category,
    });
  }
  return result;
}
