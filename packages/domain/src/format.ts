import { parseTimestamp } from './time';

export const LOCALE = 'es-CO';
export const TIME_ZONE = 'America/Bogota';
export const EMPTY_VALUE = '—';

const dateTimeFormat = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const timeFormat = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const relativeFormat = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'always', style: 'short' });

export function formatNumber(value: number | null | undefined, maximumFractionDigits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return EMPTY_VALUE;
  return new Intl.NumberFormat(LOCALE, { maximumFractionDigits }).format(value);
}

export function formatDateTime(iso: string | null | undefined): string {
  const date = parseTimestamp(iso);
  return date ? dateTimeFormat.format(date) : EMPTY_VALUE;
}

export function formatTime(iso: string | null | undefined): string {
  const date = parseTimestamp(iso);
  return date ? timeFormat.format(date) : EMPTY_VALUE;
}

export function formatRelative(iso: string | null | undefined, now: Date): string {
  const date = parseTimestamp(iso);
  if (!date) return EMPTY_VALUE;
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'justo ahora';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return relativeFormat.format(-minutes, 'minute');
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return relativeFormat.format(-hours, 'hour');
  return relativeFormat.format(-Math.floor(hours / 24), 'day');
}

const dateFormat = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const dayMonthFormat = new Intl.DateTimeFormat(LOCALE, { timeZone: TIME_ZONE, day: 'numeric', month: 'short' });

const TWO_DAYS_MS = 2 * 24 * 3_600_000;

export function formatDate(iso: string | null | undefined): string {
  const date = parseTimestamp(iso);
  return date ? dateFormat.format(date) : EMPTY_VALUE;
}

/** Etiqueta de eje de tiempo en hora de Bogotá: hora para tramos de hasta 2 días; día y mes para tramos mayores. */
export function formatAxisTick(ms: number, spanMs: number): string {
  const date = new Date(ms);
  return spanMs <= TWO_DAYS_MS ? timeFormat.format(date) : dayMonthFormat.format(date);
}
