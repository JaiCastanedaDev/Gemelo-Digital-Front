import type { AlertResidente } from '@gd/api';
import { sortAlertsForInbox } from '@gd/domain';
import { POLL_INTERVALS_MS, useAlerts } from '@gd/query';
import { useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { useSession } from '../../app/session/SessionProvider';
import { DataState } from '../../ui/DataState';
import { AlertDetailPanel } from './AlertDetailPanel';
import { AlertFiltersBar } from './AlertFiltersBar';
import { AlertList } from './AlertList';
import { apiFilters, matchesClientFilters, readAlertsView, writeAlertsView, type AlertsView } from './alertFilters';
import styles from './Alerts.module.css';

function visibleAlerts(alerts: AlertResidente[], view: AlertsView): AlertResidente[] {
  return sortAlertsForInbox(alerts.filter((a) => matchesClientFilters(a, view)));
}

export function AlertsPage() {
  const { session } = useSession();
  const [params, setParams] = useSearchParams();
  const view = readAlertsView(params);
  const role = session?.claims.role ?? 'RESIDENTE';
  const query = useAlerts(role, apiFilters(view));

  const closeDetail = useCallback(() => {
    setParams(
      (previous) => {
        const next = readAlertsView(previous);
        delete next.alertId;
        return writeAlertsView(next);
      },
      { replace: true },
    );
  }, [setParams]);

  if (!session) return null;

  const sensorOptions = [...new Set((query.data?.data ?? []).map((a) => a.sensor_id))].sort();

  return (
    <div className={styles.page}>
      <header>
        <h1>Alertas</h1>
        <p className={styles.intro}>Avisos de cambios medibles detectados en las zonas comunes.</p>
      </header>
      <AlertFiltersBar
        view={view}
        sensorOptions={sensorOptions}
        onChange={(next) => setParams(writeAlertsView(next), { replace: true })}
      />
      <div className={styles.layout} data-detail={view.alertId ? 'open' : undefined}>
        <section aria-label="Lista de alertas">
          <DataState
            label="alertas"
            query={query}
            staleAfterMs={POLL_INTERVALS_MS.alerts * 2}
            isEmpty={(data) => visibleAlerts(data.data, view).length === 0}
            emptyMessage="No hay alertas con estos filtros."
          >
            {(data) => <AlertList alerts={visibleAlerts(data.data, view)} view={view} isAdmin={role === 'ADMIN'} />}
          </DataState>
        </section>
        {view.alertId && <AlertDetailPanel key={view.alertId} alertId={view.alertId} role={role} onClose={closeDetail} />}
      </div>
    </div>
  );
}
