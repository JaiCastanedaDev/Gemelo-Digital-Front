import { z } from 'zod';
import { idSchema, roleSchema } from './common';

/** El contrato no fija los campos de `user`; se exige lo mínimo y se conserva el resto. */
export const sessionUserSchema = z.looseObject({
  id: idSchema.optional(),
  email: z.string(),
  name: z.string().nullish(),
  role: roleSchema,
});
export type SessionUser = z.infer<typeof sessionUserSchema>;

const tokenFields = {
  access_token: z.string(),
  refresh_token: z.string(),
  token_type: z.string(),
  expires_in: z.number().positive(),
};

export const loginResponseSchema = z.object({ ...tokenFields, user: sessionUserSchema });
export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const refreshResponseSchema = z.object({ ...tokenFields, user: sessionUserSchema.optional() });
export type RefreshResponse = z.infer<typeof refreshResponseSchema>;
