export const RANGE_KEYS = ['1h', '24h', '7d', '30d'] as const;
export type RangeKey = (typeof RANGE_KEYS)[number];
export const DEFAULT_RANGE: RangeKey = '24h';

const HOUR_MS = 3_600_000;
export const DAY_MS = 24 * HOUR_MS;

export const RANGE_MS: Record<RangeKey, number> = {
  '1h': HOUR_MS,
  '24h': DAY_MS,
  '7d': 7 * DAY_MS,
  '30d': 30 * DAY_MS,
};

export function isRangeKey(value: unknown): value is RangeKey {
  return typeof value === 'string' && (RANGE_KEYS as readonly string[]).includes(value);
}

export function shorterRange(key: RangeKey): RangeKey | null {
  const index = RANGE_KEYS.indexOf(key);
  return index > 0 ? (RANGE_KEYS[index - 1] ?? null) : null;
}

export interface TimeWindow {
  from: number;
  to: number;
}

export function rangeWindow(key: RangeKey, now: number): TimeWindow {
  return { from: now - RANGE_MS[key], to: now };
}

export interface ReadingsChunk {
  desde: string;
  hasta: string;
  /** El día ya terminó: sus lecturas no cambian y se pueden cachear para siempre. */
  closed: boolean;
}

/** Días UTC que tocan la ventana. Claves estables durante el día para que la caché funcione. */
export function dailyChunks(window: TimeWindow, now: number): ReadingsChunk[] {
  const chunks: ReadingsChunk[] = [];
  for (let start = Math.floor(window.from / DAY_MS) * DAY_MS; start < window.to; start += DAY_MS) {
    const end = start + DAY_MS;
    chunks.push({ desde: new Date(start).toISOString(), hasta: new Date(end).toISOString(), closed: end <= now });
  }
  return chunks;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
/** Bogotá es UTC−5 todo el año (sin horario de verano). */
const BOGOTA_OFFSET_MS = 5 * HOUR_MS;

export function bogotaDayStart(date: string): number | null {
  const match = ISO_DATE.exec(date);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utcMidnight = Date.UTC(year, month - 1, day);
  const check = new Date(utcMidnight);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return utcMidnight + BOGOTA_OFFSET_MS;
}

export function bogotaDateRange(desde?: string, hasta?: string): { from: number | null; to: number | null } {
  const from = desde ? bogotaDayStart(desde) : null;
  const toStart = hasta ? bogotaDayStart(hasta) : null;
  return { from, to: toStart === null ? null : toStart + DAY_MS };
}
