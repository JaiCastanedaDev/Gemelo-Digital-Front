/** Fecha y hora ISO-8601 sin designador de zona (ni Z ni ±hh:mm). */
const OFFSET_LESS_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/;

/**
 * Convierte un ISO-8601 en Date; devuelve null si falta o no es válido.
 * Un date-time sin zona se interpreta como UTC: `new Date` lo leería en la hora local del navegador
 * (Bogotá, UTC-5) y un sensor silencioso parecería reportar 5 h en el futuro.
 */
export function parseTimestamp(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const date = new Date(OFFSET_LESS_DATE_TIME.test(iso) ? `${iso}Z` : iso);
  return Number.isNaN(date.getTime()) ? null : date;
}
