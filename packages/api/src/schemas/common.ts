import { z } from 'zod';

export const roleSchema = z.enum(['ADMIN', 'RESIDENTE']);
export type Role = z.infer<typeof roleSchema>;

export const alertLevelSchema = z.enum(['CRITICAL', 'WARNING', 'INFO']);
export const sensorCategorySchema = z.enum(['structural', 'consumption', 'comfort']);

/** Identificadores que el backend podría enviar como número o texto; se normalizan a texto. */
export const idSchema = z.union([z.string(), z.number()]).transform(String);

export const errorEnvelopeSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }),
});

/** Listas cuya forma exacta no está fijada en el contrato: arreglo plano u objeto { data }. */
export function listOf<T extends z.ZodType>(item: T) {
  return z
    .union([z.array(item), z.object({ data: z.array(item) })])
    .transform((value) => (Array.isArray(value) ? value : value.data));
}
