import type { DashboardGeneral } from '@gd/api';
import { KpiCard } from '../../ui/KpiCard';
import styles from './Home.module.css';

export function SensorKpis({ data }: { data: DashboardGeneral }) {
  const { total, online, offline } = data.sensors;
  return (
    <div className={styles.grid}>
      <KpiCard label="Sensores en línea" value={`${online} de ${total}`} tone="OK" />
      <KpiCard
        label="Sensores sin datos"
        value={offline}
        tone={offline > 0 ? 'OFFLINE' : 'OK'}
        hint="Sin reporte en los últimos 15 minutos"
      />
    </div>
  );
}
