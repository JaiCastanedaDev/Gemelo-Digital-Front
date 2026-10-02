import type { DashboardGeneral } from '@gd/api';
import { KpiCard } from '../../ui/KpiCard';
import styles from './Home.module.css';

export function AlertKpis({ data }: { data: DashboardGeneral }) {
  const { CRITICAL, WARNING, INFO } = data.alerts_summary;
  return (
    <div className={styles.grid}>
      <KpiCard label="Alertas críticas" value={CRITICAL} tone={CRITICAL > 0 ? 'CRITICAL' : 'OK'} />
      <KpiCard label="Advertencias" value={WARNING} tone={WARNING > 0 ? 'WARNING' : 'OK'} />
      <KpiCard label="Informativas" value={INFO} tone={INFO > 0 ? 'INFO' : 'OK'} />
    </div>
  );
}
