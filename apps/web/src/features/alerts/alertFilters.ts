import type { AlertFilters } from '@gd/api';
import type { AlertLevel } from '@gd/domain';

const LEVELS: readonly AlertLevel[] = ['CRITICAL', 'WARNING', 'INFO'];
const CATEGORIES = ['structural', 'consumption', 'comfort'] as const;
type Category = (typeof CATEGORIES)[number];
const ALERT_ID = /^[A-Za-z0-9_-]{1,64}$/;

export interface AlertsView {
  level?: AlertLevel;
  acknowledged?: boolean;
  category?: Category;
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
  const alertId = params.get('alerta');
  if (alertId !== null && ALERT_ID.test(alertId)) view.alertId = alertId;
  return view;
}

export function writeAlertsView(view: AlertsView): URLSearchParams {
  const params = new URLSearchParams();
  if (view.level) params.set('nivel', view.level);
  if (view.acknowledged !== undefined) params.set('acusada', String(view.acknowledged));
  if (view.category) params.set('categoria', view.category);
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
