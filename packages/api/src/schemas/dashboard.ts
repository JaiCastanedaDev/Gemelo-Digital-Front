import { z } from 'zod';
import { alertLevelSchema } from './common';

const count = z.number().int().nonnegative();

export const dashboardGeneralSchema = z.object({
  health_score: z.number(),
  alerts_summary: z.object({ CRITICAL: count, WARNING: count, INFO: count, total: count }),
  sensors: z.object({ total: count, online: count, offline: count }),
  generated_at: z.string(),
});
export type DashboardGeneral = z.infer<typeof dashboardGeneralSchema>;

/** `alerts` es ambiguo en el contrato (conteo o lista); se normaliza a conteo. */
const alertCount = z.union([count, z.array(z.unknown()).transform((list) => list.length)]);

export const dashboardStructuralSchema = z.object({
  structural_score: z.number(),
  sensors_in_alert: z.array(z.object({ sensor_id: z.string(), level: alertLevelSchema, alerts: alertCount })),
});
export type DashboardStructural = z.infer<typeof dashboardStructuralSchema>;

export const dashboardConsumptionSchema = z.object({
  period: z.object({ from: z.string(), to: z.string() }),
  by_unit: z.array(
    z.object({
      unit: z.string(),
      current_period: z.number(),
      previous_period: z.number().nullable(),
      variation_pct: z.number().nullable(),
    }),
  ),
});
export type DashboardConsumption = z.infer<typeof dashboardConsumptionSchema>;

export const comfortIndexSchema = z.enum(['BUENO', 'REGULAR', 'MALO']);

const comfortZoneBase = {
  zone: z.string(),
  index: comfortIndexSchema,
  sensors: z.union([count, z.array(z.string())]),
};

export const comfortResidenteSchema = z.object({ zones: z.array(z.object(comfortZoneBase)) });
export type ComfortResidente = z.infer<typeof comfortResidenteSchema>;

export const comfortAdminSchema = z.object({
  zones: z.array(z.object({ ...comfortZoneBase, ppm: z.number().nullable().optional() })),
});
export type ComfortAdmin = z.infer<typeof comfortAdminSchema>;
