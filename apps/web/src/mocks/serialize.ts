import type { AlertAdmin, AlertResidente } from '@gd/api';

/** Lista blanca: el residente nunca recibe valores numéricos ni datos de acuse. */
export function toResidenteAlert(alert: AlertAdmin): AlertResidente {
  const { alert_id, building_id, sensor_id, level, category, message, timestamp, acknowledged } = alert;
  return { alert_id, building_id, sensor_id, level, category, message, timestamp, acknowledged };
}
