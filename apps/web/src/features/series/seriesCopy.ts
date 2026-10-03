import { formatNumber } from '@gd/domain';

const SERIES_LABEL: Record<string, string> = {
  x: 'Eje X',
  y: 'Eje Y',
  z: 'Eje Z',
  width: 'Apertura',
  flow: 'Caudal',
  power: 'Potencia',
  co2: 'CO₂',
};

/** Cambio medido con signo explícito; el signo se decide tras redondear (0,00 no lleva signo). */
export function formatChange(change: number, unit: string | null): string {
  const rounded = Math.round(Math.abs(change) * 100) / 100;
  const sign = rounded === 0 ? '' : change < 0 ? '−' : '+';
  return `${sign}${formatNumber(rounded, 2)}${unit ? ` ${unit}` : ''}`;
}

export function seriesLabel(key: string): string {
  return SERIES_LABEL[key] ?? key;
}
