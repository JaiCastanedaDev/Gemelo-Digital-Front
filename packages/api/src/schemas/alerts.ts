import { z } from 'zod';
import { alertLevelSchema, idSchema } from './common';

/** Forma que recibe el RESIDENTE: sin valores numéricos. z.object descarta claves desconocidas. */
export const alertResidenteSchema = z.object({
  alert_id: z.string(),
  building_id: idSchema,
  sensor_id: z.string(),
  level: alertLevelSchema,
  category: z.string(),
  message: z.string(),
  timestamp: z.string(),
  acknowledged: z.boolean(),
});
export type AlertResidente = z.infer<typeof alertResidenteSchema>;

export const alertAdminSchema = alertResidenteSchema.extend({
  value_triggered: z.number().nullable(),
  threshold_configured: z.number().nullable(),
  occurrence_count: z.number().int().positive(),
  acknowledged_by: z.string().nullable(),
  acknowledged_at: z.string().nullable(),
});
export type AlertAdmin = z.infer<typeof alertAdminSchema>;

export const alertListResidenteSchema = z.object({ count: z.number().int(), data: z.array(alertResidenteSchema) });
export type AlertListResidente = z.infer<typeof alertListResidenteSchema>;

export const alertListAdminSchema = z.object({ count: z.number().int(), data: z.array(alertAdminSchema) });
export type AlertListAdmin = z.infer<typeof alertListAdminSchema>;

/** En runtime, el ADMIN recibe campos extra; se distinguen por `occurrence_count`. */
export function isAdminAlert(alert: AlertResidente): alert is AlertAdmin {
  return typeof (alert as Partial<AlertAdmin>).occurrence_count === 'number';
}
