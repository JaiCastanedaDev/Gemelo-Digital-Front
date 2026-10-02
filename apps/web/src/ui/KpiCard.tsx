import type { StatusLevel } from '@gd/domain';
import type { ReactNode } from 'react';
import styles from './KpiCard.module.css';

interface KpiCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: StatusLevel;
}

export function KpiCard({ label, value, hint, tone }: KpiCardProps) {
  return (
    <div className={styles.card} data-tone={tone}>
      <p className={styles.label}>{label}</p>
      <p className={styles.value}>{value}</p>
      {hint && <p className={styles.hint}>{hint}</p>}
    </div>
  );
}
