import type { StatusLevel } from './levels';

export type ComfortIndex = 'BUENO' | 'REGULAR' | 'MALO';

/** La etiqueta la decide el backend; el front solo la traduce a un estado visual (spec §6.2). */
export const COMFORT_TONE: Record<ComfortIndex, StatusLevel> = {
  BUENO: 'OK',
  REGULAR: 'WARNING',
  MALO: 'CRITICAL',
};
