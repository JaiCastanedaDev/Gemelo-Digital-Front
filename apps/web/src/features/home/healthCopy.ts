import type { HealthBand, ScoreDeduction, StatusLevel } from '@gd/domain';

export const BAND_LABEL: Record<HealthBand, string> = {
  GOOD: 'Buen estado',
  ATTENTION: 'Requiere atención',
  PRIORITY: 'Atención prioritaria',
};

export const BAND_TONE: Record<HealthBand, StatusLevel> = {
  GOOD: 'OK',
  ATTENTION: 'WARNING',
  PRIORITY: 'CRITICAL',
};

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export function deductionText(deduction: ScoreDeduction): string {
  const { count } = deduction;
  switch (deduction.reason) {
    case 'CRITICAL':
      return plural(count, 'alerta crítica', 'alertas críticas');
    case 'WARNING':
      return plural(count, 'advertencia', 'advertencias');
    case 'INFO':
      return plural(count, 'alerta informativa', 'alertas informativas');
    case 'OFFLINE':
      return plural(count, 'sensor sin datos', 'sensores sin datos');
  }
}
