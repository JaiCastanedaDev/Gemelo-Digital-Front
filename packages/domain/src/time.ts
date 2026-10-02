/** Convierte un ISO-8601 en Date; devuelve null si falta o no es válido. */
export function parseTimestamp(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}
