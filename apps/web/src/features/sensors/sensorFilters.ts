import type { StatusLevel } from '@gd/domain';

const STATUSES: readonly StatusLevel[] = ['CRITICAL', 'WARNING', 'INFO', 'OK', 'OFFLINE'];
const CATEGORIES = ['structural', 'consumption', 'comfort'] as const;
type Category = (typeof CATEGORIES)[number];

/** Texto imprimible de 1 a 80 caracteres (sin controles). */
function isZone(value: string): boolean {
  if (value.length < 1 || value.length > 80) return false;
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return false;
  }
  return true;
}

export interface SensorFilters {
  status?: StatusLevel;
  category?: Category;
  zone?: string;
}

export function readSensorFilters(params: URLSearchParams): SensorFilters {
  const filters: SensorFilters = {};
  const status = STATUSES.find((s) => s === params.get('estado'));
  if (status) filters.status = status;
  const category = CATEGORIES.find((c) => c === params.get('categoria'));
  if (category) filters.category = category;
  const zone = params.get('zona');
  if (zone !== null && isZone(zone)) filters.zone = zone;
  return filters;
}

export function writeSensorFilters(params: URLSearchParams, filters: SensorFilters): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const key of ['estado', 'categoria', 'zona']) next.delete(key);
  if (filters.status) next.set('estado', filters.status);
  if (filters.category) next.set('categoria', filters.category);
  if (filters.zone) next.set('zona', filters.zone);
  return next;
}
