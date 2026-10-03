import { RANGE_KEYS, type RangeKey } from '@gd/domain';
import styles from './Chart.module.css';

export const RANGE_LABEL: Record<RangeKey, string> = {
  '1h': '1 hora',
  '24h': '24 horas',
  '7d': '7 días',
  '30d': '30 días',
};

export function RangeSelector({ value, onChange }: { value: RangeKey; onChange: (next: RangeKey) => void }) {
  return (
    <div className={styles.ranges} role="group" aria-label="Rango de tiempo">
      {RANGE_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          className={styles.range}
          aria-pressed={key === value}
          onClick={() => onChange(key)}
        >
          {RANGE_LABEL[key]}
        </button>
      ))}
    </div>
  );
}
