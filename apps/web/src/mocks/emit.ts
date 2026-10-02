import type { AlertAdmin } from '@gd/api';
import { db } from './db';
import { realtimeBus } from './realtimeBus';
import { BUILDING_ID } from './seed';

const DEFAULTS = {
  CRITICAL: { sensorId: 'acc-t1-sotano', message: 'Aceleración superior al umbral configurado', value: 0.41, threshold: 0.2 },
  WARNING: { sensorId: 'crack-t2-cubierta', message: 'Cambio medido en la apertura de fisura', value: 0.95, threshold: 0.8 },
} as const;

export interface MockAlertInput {
  /** El backend solo emite CRITICAL y WARNING por socket (INFO va por polling). */
  level: 'CRITICAL' | 'WARNING';
  sensorId?: string;
  message?: string;
}

function nextAlertId(now: number): string {
  const seq = db.alerts.reduce((max, a) => Math.max(max, Number(a.alert_id.slice(-5)) || 0), 0) + 1;
  const ymd = new Date(now).toISOString().slice(0, 10).replace(/-/g, '');
  return `alrt-${ymd}-${String(seq).padStart(5, '0')}`;
}

/** Simula una alerta del backend: deduplica por sensor+nivel abiertos y la publica por "socket". */
export function emitMockAlert(input: MockAlertInput): AlertAdmin {
  const defaults = DEFAULTS[input.level];
  const sensorId = input.sensorId ?? defaults.sensorId;
  const now = Date.now();
  const timestamp = new Date(now).toISOString();
  const open = db.alerts.find((a) => a.sensor_id === sensorId && a.level === input.level && !a.acknowledged);

  let alert: AlertAdmin;
  if (open) {
    open.occurrence_count += 1;
    open.timestamp = timestamp;
    open.value_triggered = defaults.value;
    alert = open;
  } else {
    alert = {
      alert_id: nextAlertId(now),
      building_id: BUILDING_ID,
      sensor_id: sensorId,
      level: input.level,
      category: db.sensors.find((s) => s.sensor_id === sensorId)?.category ?? 'structural',
      message: input.message ?? defaults.message,
      timestamp,
      acknowledged: false,
      value_triggered: defaults.value,
      threshold_configured: defaults.threshold,
      occurrence_count: 1,
      acknowledged_by: null,
      acknowledged_at: null,
    };
    db.alerts.push(alert);
  }
  realtimeBus.publishAlert({ ...alert });
  return alert;
}
