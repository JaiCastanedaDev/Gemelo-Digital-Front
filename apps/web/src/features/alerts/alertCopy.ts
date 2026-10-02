const CATEGORY_LABEL: Record<string, string> = {
  structural: 'Estructural',
  consumption: 'Consumos',
  comfort: 'Calidad del aire',
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABEL[category] ?? category;
}

export const LEVEL_OPTIONS = [
  { value: '', label: 'Todos los niveles' },
  { value: 'CRITICAL', label: 'Crítico' },
  { value: 'WARNING', label: 'Advertencia' },
  { value: 'INFO', label: 'Informativo' },
] as const;

export const STATE_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'false', label: 'Sin revisar' },
  { value: 'true', label: 'Revisadas' },
] as const;

export const CATEGORY_OPTIONS = [
  { value: '', label: 'Todas las categorías' },
  { value: 'structural', label: 'Estructural' },
  { value: 'consumption', label: 'Consumos' },
  { value: 'comfort', label: 'Calidad del aire' },
] as const;
