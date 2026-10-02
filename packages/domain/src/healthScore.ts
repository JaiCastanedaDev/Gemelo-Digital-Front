export interface HealthInputs {
  critical: number;
  warning: number;
  info: number;
  offlineSensors: number;
}

export type DeductionReason = 'CRITICAL' | 'WARNING' | 'INFO' | 'OFFLINE';

export interface ScoreDeduction {
  reason: DeductionReason;
  count: number;
  points: number;
}

/** Pesos de la fórmula del backend: 100 − (25·crít + 10·adv + 2·info + 5·offline). */
export const DEDUCTION_WEIGHTS: Record<DeductionReason, number> = {
  CRITICAL: 25,
  WARNING: 10,
  INFO: 2,
  OFFLINE: 5,
};

export function scoreBreakdown(inputs: HealthInputs): ScoreDeduction[] {
  const counts: [DeductionReason, number][] = [
    ['CRITICAL', inputs.critical],
    ['WARNING', inputs.warning],
    ['OFFLINE', inputs.offlineSensors],
    ['INFO', inputs.info],
  ];
  return counts
    .filter(([, count]) => count > 0)
    .map(([reason, count]) => ({ reason, count, points: count * DEDUCTION_WEIGHTS[reason] }));
}

export type HealthBand = 'GOOD' | 'ATTENTION' | 'PRIORITY';

export interface HealthBands {
  good: number;
  attention: number;
}

/** Propuesta inicial; pendiente de validar con negocio (ver spec §6.1). */
export const DEFAULT_HEALTH_BANDS: HealthBands = { good: 80, attention: 50 };

export function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.min(100, Math.max(0, Math.round(score)));
}

export function healthBand(score: number, bands: HealthBands = DEFAULT_HEALTH_BANDS): HealthBand {
  const value = clampScore(score);
  if (value >= bands.good) return 'GOOD';
  if (value >= bands.attention) return 'ATTENTION';
  return 'PRIORITY';
}
