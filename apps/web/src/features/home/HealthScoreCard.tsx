import type { DashboardGeneral } from '@gd/api';
import { clampScore, healthBand, isStale, scoreBreakdown } from '@gd/domain';
import { POLL_INTERVALS_MS } from '@gd/query';
import { STATUS_META } from '../../ui/statusMeta';
import styles from './Home.module.css';
import { BAND_LABEL, BAND_TONE, deductionLine } from './healthCopy';

export function HealthScoreCard({ data, now, isAdmin }: { data: DashboardGeneral; now: Date; isAdmin: boolean }) {
  const score = clampScore(data.health_score);
  const band = healthBand(score);
  const tone = BAND_TONE[band];
  const { Icon } = STATUS_META[tone];
  const deductions = scoreBreakdown({
    critical: data.alerts_summary.CRITICAL,
    warning: data.alerts_summary.WARNING,
    info: data.alerts_summary.INFO,
    offlineSensors: data.sensors.offline,
  });
  const stale = isStale(data.generated_at, now, POLL_INTERVALS_MS.dashboardGeneral * 2);

  return (
    <>
      <div className={styles.scoreRow}>
        <p className={styles.score}>
          <span>{score}</span>
          <span className={styles.scoreMax}>/100</span>
        </p>
        <span className={styles.band} data-tone={tone}>
          <Icon aria-hidden="true" size={18} />
          {BAND_LABEL[band]}
        </span>
      </div>
      {deductions.length > 0 ? (
        <ul className={styles.deductions} aria-label="Qué resta puntos">
          {deductions.map((d) => (
            <li key={d.reason}>{deductionLine(d, isAdmin)}</li>
          ))}
        </ul>
      ) : (
        <p className={styles.note}>Sin alertas abiertas ni sensores sin datos.</p>
      )}
      <p className={styles.note}>Puntaje calculado a partir de las alertas abiertas y los sensores sin datos.</p>
      {stale && <span className={styles.staleTag}>Dato desactualizado</span>}
    </>
  );
}
