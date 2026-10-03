import { formatNumber } from './format';

export type VariationDirection = 'up' | 'down' | 'flat';

export interface VariationView {
  text: string;
  direction: VariationDirection | null;
}

/** Variación del mes en curso frente al mismo tramo del mes anterior (spec §6.2). */
export function describeVariation(pct: number | null): VariationView {
  if (pct === null || !Number.isFinite(pct)) return { text: 'Sin datos del periodo anterior', direction: null };
  const rounded = Math.round(pct * 10) / 10;
  if (rounded === 0) return { text: 'Igual que el mismo tramo del mes anterior', direction: 'flat' };
  const up = rounded > 0;
  return {
    text: `${up ? '↑' : '↓'} ${formatNumber(Math.abs(rounded))} % frente al mismo tramo del mes anterior`,
    direction: up ? 'up' : 'down',
  };
}
