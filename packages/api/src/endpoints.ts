import type { HttpClient } from './http';
import { alertAdminSchema, alertListAdminSchema, alertListResidenteSchema } from './schemas/alerts';
import {
  comfortAdminSchema,
  comfortResidenteSchema,
  dashboardConsumptionSchema,
  dashboardGeneralSchema,
  dashboardStructuralSchema,
} from './schemas/dashboard';
import { maintenanceListSchema, maintenanceTaskSchema, type MaintenanceStatus } from './schemas/maintenance';
import { readingListSchema, sensorListSchema } from './schemas/sensors';

export interface AlertFilters {
  level?: 'CRITICAL' | 'WARNING' | 'INFO';
  acknowledged?: boolean;
}

export interface DateRange {
  desde?: string;
  hasta?: string;
}

const alertQuery = (filters: AlertFilters) => ({ level: filters.level, acknowledged: filters.acknowledged });
const enc = encodeURIComponent;

export function createApi(http: HttpClient) {
  return {
    dashboard: {
      general: (signal?: AbortSignal) => http.get('/dashboard/general', { schema: dashboardGeneralSchema, signal }),
      structural: (signal?: AbortSignal) =>
        http.get('/dashboard/structural', { schema: dashboardStructuralSchema, signal }),
      consumption: (signal?: AbortSignal) =>
        http.get('/dashboard/consumption', { schema: dashboardConsumptionSchema, signal }),
      comfortAdmin: (signal?: AbortSignal) => http.get('/dashboard/comfort', { schema: comfortAdminSchema, signal }),
      comfortResidente: (signal?: AbortSignal) =>
        http.get('/dashboard/comfort', { schema: comfortResidenteSchema, signal }),
    },
    sensors: {
      list: (signal?: AbortSignal) => http.get('/sensors', { schema: sensorListSchema, signal }),
      readings: (sensorId: string, range: DateRange, signal?: AbortSignal) =>
        http.get(`/sensors/${enc(sensorId)}/data`, {
          schema: readingListSchema,
          query: { desde: range.desde, hasta: range.hasta },
          signal,
        }),
    },
    alerts: {
      listAdmin: (filters: AlertFilters = {}, signal?: AbortSignal) =>
        http.get('/alerts', { schema: alertListAdminSchema, query: alertQuery(filters), signal }),
      listResidente: (filters: AlertFilters = {}, signal?: AbortSignal) =>
        http.get('/alerts', { schema: alertListResidenteSchema, query: alertQuery(filters), signal }),
      ack: (alertId: string) => http.post(`/alerts/${enc(alertId)}/ack`, { schema: alertAdminSchema }),
    },
    maintenance: {
      list: (status?: MaintenanceStatus, signal?: AbortSignal) =>
        http.get('/maintenance', { schema: maintenanceListSchema, query: { status }, signal }),
      create: (input: { description: string; due_date?: string | null }) =>
        http.post('/maintenance', { schema: maintenanceTaskSchema, body: input }),
    },
    reports: {
      structuralHealth: (range: DateRange = {}, signal?: AbortSignal) =>
        http.getBlob('/reports/structural_health', { query: { desde: range.desde, hasta: range.hasta }, signal }),
    },
  };
}

export type Api = ReturnType<typeof createApi>;
