import type { AlertFilters, AlertResidente } from '@gd/api';
import { bogotaDateRange, bogotaDayStart, parseTimestamp, type AlertLevel } from '@gd/domain';

const LEVELS: readonly AlertLevel[] = ['CRITICAL', 'WARNING', 'INFO'];
const CATEGORIES = ['structural', 'consumption', 'comfort'] as const;
type Category = (typeof CATEGORIES)[number];
const ALERT_ID = /^[A-Za-z0-9_-]{1,64}$/;

export interface AlertsView {
  level?: AlertLevel;
  acknowledged?: boolean;
  category?: Category;
  sensorId?: string;
  /** `YYYY-MM-DD` en hora de Bogotá. */
  from?: string;
  to?: string;
  alertId?: string;
}

function isLevel(value: string | null): value is AlertLevel {
  return value !== null && (LEVELS as readonly string[]).includes(value);
}

function isCategory(value: string | null): value is Category {
  return value !== null && (CATEGORIES as readonly string[]).includes(value);
}

export function readAlertsView(params: URLSearchParams): AlertsView {
  const view: AlertsView = {};
  const level = params.get('nivel');
  if (isLevel(level)) view.level = level;
  const acknowledged = params.get('acusada');
  if (acknowledged === 'true' || acknowledged === 'false') view.acknowledged = acknowledged === 'true';
  const category = params.get('categoria');
  if (isCategory(category)) view.category = category;
  const sensorId = params.get('sensor');
  if (sensorId !== null && ALERT_ID.test(sensorId)) view.sensorId = sensorId;
  const from = params.get('desde');
  if (from !== null && bogotaDayStart(from) !== null) view.from = from;
  const to = params.get('hasta');
  if (to !== null && bogotaDayStart(to) !== null) view.to = to;
  const alertId = params.get('alerta');
  if (alertId !== null && ALERT_ID.test(alertId)) view.alertId = alertId;
  return view;
}

export function writeAlertsView(view: AlertsView): URLSearchParams {
  const params = new URLSearchParams();
  if (view.level) params.set('nivel', view.level);
  if (view.acknowledged !== undefined) params.set('acusada', String(view.acknowledged));
  if (view.category) params.set('categoria', view.category);
  if (view.sensorId) params.set('sensor', view.sensorId);
  if (view.from) params.set('desde', view.from);
  if (view.to) params.set('hasta', view.to);
  if (view.alertId) params.set('alerta', view.alertId);
  return params;
}

/** Nivel y estado los filtra la API; la categoría se filtra en el cliente. */
export function apiFilters(view: AlertsView): AlertFilters {
  const filters: AlertFilters = {};
  if (view.level) filters.level = view.level;
  if (view.acknowledged !== undefined) filters.acknowledged = view.acknowledged;
  return filters;
}

/** Rango invertido: se ignora el filtro de fechas (la UI lo avisa). */
export function datesInverted(view: AlertsView): boolean {
  const { from, to } = bogotaDateRange(view.from, view.to);
  return from !== null && to !== null && from >= to;
}

/** Categoría, sensor y fechas se filtran en el cliente (la API solo filtra nivel y estado). */
export function matchesClientFilters(alert: AlertResidente, view: AlertsView): boolean {
  if (view.category && alert.category !== view.category) return false;
  if (view.sensorId && alert.sensor_id !== view.sensorId) return false;
  if (!datesInverted(view)) {
    const { from, to } = bogotaDateRange(view.from, view.to);
    const time = parseTimestamp(alert.timestamp)?.getTime();
    if (time === undefined) return from === null && to === null;
    if (from !== null && time < from) return false;
    if (to !== null && time >= to) return false;
  }
  return true;
}
