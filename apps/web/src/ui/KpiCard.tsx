import type { StatusLevel } from '@gd/domain';
import type { ReactNode } from 'react';
import styles from './KpiCard.module.css';
import { STATUS_META } from './statusMeta';

interface KpiCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: StatusLevel;
}

export function KpiCard({ label, value, hint, tone }: KpiCardProps) {
  // El ícono acompaña al color para que el estado nunca dependa solo del color (spec §9.1).
  const Icon = tone ? STATUS_META[tone].Icon : null;
  return (
    <div className={styles.card} data-tone={tone}>
      <p className={styles.label}>
        {Icon && <Icon aria-hidden="true" size={16} />}
        {label}
      </p>
      <p className={styles.value}>{value}</p>
      {hint && <p className={styles.hint}>{hint}</p>}
    </div>
  );
}
