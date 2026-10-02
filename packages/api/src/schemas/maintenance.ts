import { z } from 'zod';
import { idSchema, listOf } from './common';

export const maintenanceStatusSchema = z.enum(['PENDING', 'IN_PROGRESS', 'DONE']);
export type MaintenanceStatus = z.infer<typeof maintenanceStatusSchema>;

export const maintenanceTaskSchema = z.object({
  id: idSchema,
  description: z.string(),
  status: maintenanceStatusSchema,
  due_date: z.string().nullish(),
  completed_at: z.string().nullish(),
  completed_by: z.string().nullish(),
  evidence_url: z.string().nullish(),
});
export type MaintenanceTask = z.infer<typeof maintenanceTaskSchema>;

export const maintenanceListSchema = listOf(maintenanceTaskSchema);
