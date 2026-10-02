export type AlertLevel = 'CRITICAL' | 'WARNING' | 'INFO';
export type StatusLevel = AlertLevel | 'OK' | 'OFFLINE';
export type SensorCategory = 'structural' | 'consumption' | 'comfort';

const ALERT_SEVERITY: Record<AlertLevel, number> = { CRITICAL: 3, WARNING: 2, INFO: 1 };

export function mostSevere(levels: readonly AlertLevel[]): AlertLevel | null {
  let worst: AlertLevel | null = null;
  for (const level of levels) {
    if (worst === null || ALERT_SEVERITY[level] > ALERT_SEVERITY[worst]) worst = level;
  }
  return worst;
}

/** Comparador para `sort`: deja primero el nivel más severo. */
export function compareAlertLevel(a: AlertLevel, b: AlertLevel): number {
  return ALERT_SEVERITY[b] - ALERT_SEVERITY[a];
}
