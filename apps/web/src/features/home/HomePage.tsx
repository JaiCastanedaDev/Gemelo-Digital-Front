import { POLL_INTERVALS_MS, useDashboardGeneral } from '@gd/query';
import { useSession } from '../../app/session/SessionProvider';
import { DataState } from '../../ui/DataState';
import { useNow } from '../../ui/useNow';
import { AlertKpis } from './AlertKpis';
import { CategoryLinks } from './CategoryLinks';
import { CriticalBanner } from './CriticalBanner';
import { HealthScoreCard } from './HealthScoreCard';
import styles from './Home.module.css';
import { SensorKpis } from './SensorKpis';

export function HomePage() {
  const { session } = useSession();
  const general = useDashboardGeneral();
  const now = useNow();
  if (!session) return null;
  const role = session.claims.role;
  const isAdmin = role === 'ADMIN';

  return (
    <div className={styles.page}>
      <h1>Estado general</h1>
      <CriticalBanner role={role} />

      <section className={styles.card} aria-labelledby="health-title">
        <h2 id="health-title">Salud del edificio</h2>
        <DataState label="salud del edificio" query={general} staleAfterMs={POLL_INTERVALS_MS.dashboardGeneral * 2}>
          {(data) => <HealthScoreCard data={data} now={now} isAdmin={isAdmin} />}
        </DataState>
      </section>

      {general.data && (
        <section aria-label="Resumen de alertas y sensores">
          <AlertKpis data={general.data} />
          {isAdmin && (
            <div style={{ marginTop: 'var(--space-4)' }}>
              <SensorKpis data={general.data} />
            </div>
          )}
        </section>
      )}

      <CategoryLinks role={role} />

      <p className={styles.disclaimer}>
        El sistema detecta y avisa cambios medibles en las zonas comunes. No reemplaza la inspección de un profesional.
      </p>
    </div>
  );
}
