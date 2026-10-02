import { compareAlertLevel, type AlertLevel } from './levels';
import { parseTimestamp } from './time';

export interface InboxAlert {
  level: AlertLevel;
  acknowledged: boolean;
  timestamp: string;
}

function timeValue(iso: string): number {
  return parseTimestamp(iso)?.getTime() ?? Number.NEGATIVE_INFINITY;
}

/** Bandeja de alertas: primero sin revisar, luego más severas, luego más recientes. */
export function compareInboxAlerts(a: InboxAlert, b: InboxAlert): number {
  if (a.acknowledged !== b.acknowledged) return a.acknowledged ? 1 : -1;
  const bySeverity = compareAlertLevel(a.level, b.level);
  if (bySeverity !== 0) return bySeverity;
  const ta = timeValue(a.timestamp);
  const tb = timeValue(b.timestamp);
  if (ta === tb) return 0;
  return tb > ta ? 1 : -1;
}

export function sortAlertsForInbox<T extends InboxAlert>(alerts: readonly T[]): T[] {
  return [...alerts].sort(compareInboxAlerts);
}
