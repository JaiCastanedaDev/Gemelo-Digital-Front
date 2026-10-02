import { ageMs, formatDateTime, formatTime, type StatusLevel } from '@gd/domain';
import styles from './StatusBadge.module.css';
import { STATUS_META } from './statusMeta';

const DAY_MS = 24 * 60 * 60 * 1000;

export function statusLabel(level: StatusLevel, lastSeenAt: string | null, now: Date): string {
  if (level !== 'OFFLINE') return STATUS_META[level].label;
  const age = ageMs(lastSeenAt, now);
  if (age === null) return 'Sin datos';
  return `Sin datos desde ${age < DAY_MS ? formatTime(lastSeenAt) : formatDateTime(lastSeenAt)}`;
}

interface StatusBadgeProps {
  level: StatusLevel;
  lastSeenAt?: string | null;
  now?: Date;
}

export function StatusBadge({ level, lastSeenAt = null, now = new Date() }: StatusBadgeProps) {
  const { Icon } = STATUS_META[level];
  return (
    <span className={styles.badge} data-level={level}>
      <Icon aria-hidden="true" size={16} />
      {statusLabel(level, lastSeenAt, now)}
    </span>
  );
}
