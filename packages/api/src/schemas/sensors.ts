import { z } from 'zod';
import { listOf, sensorCategorySchema } from './common';

export const sensorSchema = z.object({
  sensor_id: z.string(),
  name: z.string(),
  sensor_type: z.string(),
  category: sensorCategorySchema,
  zone: z.string(),
  unit: z.string().nullable(),
  status: z.string(),
  last_values: z.record(z.string(), z.number().nullable()).nullable(),
  last_battery_pct: z.number().nullable(),
  firmware_version: z.string().nullable(),
  last_seen_at: z.string().nullable(),
});
export type Sensor = z.infer<typeof sensorSchema>;

export const sensorListSchema = z.object({ count: z.number().int(), data: z.array(sensorSchema) });
export type SensorList = z.infer<typeof sensorListSchema>;

export const readingSchema = z.object({
  timestamp: z.string(),
  unit: z.string().nullable(),
  values: z.record(z.string(), z.number().nullable()),
  battery_pct: z.number().nullable(),
});
export type Reading = z.infer<typeof readingSchema>;

export const readingListSchema = listOf(readingSchema);
