const SERIES_LABEL: Record<string, string> = {
  x: 'Eje X',
  y: 'Eje Y',
  z: 'Eje Z',
  width: 'Apertura',
  flow: 'Caudal',
  power: 'Potencia',
  co2: 'CO₂',
};

export function seriesLabel(key: string): string {
  return SERIES_LABEL[key] ?? key;
}
