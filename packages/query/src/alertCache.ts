import type { AlertFilters, AlertListResidente, AlertResidente, Role } from '@gd/api';
import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from './keys';

type AlertList<T> = { count: number; data: T[] };

export function matchesAlertFilters(alert: AlertResidente, filters: AlertFilters): boolean {
  if (filters.level !== undefined && alert.level !== filters.level) return false;
  if (filters.acknowledged !== undefined && alert.acknowledged !== filters.acknowledged) return false;
  return true;
}

/** Inserta o reemplaza por `alert_id` respetando los filtros de la lista; orden por fecha descendente. */
export function upsertAlertList<T extends AlertResidente>(list: AlertList<T>, alert: T, filters: AlertFilters): AlertList<T> {
  const rest = list.data.filter((item) => item.alert_id !== alert.alert_id);
  const data = matchesAlertFilters(alert, filters) ? [alert, ...rest] : rest;
  data.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return { count: data.length, data };
}

export function markAlertAcknowledged<T extends AlertResidente>(list: AlertList<T>, alertId: string): AlertList<T> {
  return {
    count: list.count,
    data: list.data.map((item) => (item.alert_id === alertId ? { ...item, acknowledged: true } : item)),
  };
}

function filtersFromKey(key: readonly unknown[]): AlertFilters {
  const filters = key[3];
  return typeof filters === 'object' && filters !== null ? (filters as AlertFilters) : {};
}

/** Aplica una alerta (llegada por socket o devuelta por la API) a todas las listas cacheadas de ese rol. */
export function applyAlertToCache(queryClient: QueryClient, role: Role, alert: AlertResidente): void {
  const entries = queryClient.getQueriesData<AlertListResidente>({ queryKey: [...queryKeys.alerts.all(), role] });
  for (const [key, list] of entries) {
    if (!list) continue;
    queryClient.setQueryData(key, upsertAlertList(list, alert, filtersFromKey(key)));
  }
}
