import { isAdminAlert, type AlertResidente } from '@gd/api';
import { formatRelative } from '@gd/domain';
import { Link } from 'react-router';
import { StatusBadge } from '../../ui/StatusBadge';
import { useNow } from '../../ui/useNow';
import { categoryLabel } from './alertCopy';
import { writeAlertsView, type AlertsView } from './alertFilters';
import styles from './Alerts.module.css';

interface AlertListProps {
  alerts: AlertResidente[];
  view: AlertsView;
  isAdmin: boolean;
}

export function AlertList({ alerts, view, isAdmin }: AlertListProps) {
  const now = useNow();
  return (
    <ul className={styles.list} aria-label="Alertas">
      {alerts.map((alert) => (
        <li key={alert.alert_id}>
          <Link
            to={`?${writeAlertsView({ ...view, alertId: alert.alert_id }).toString()}`}
            className={styles.row}
            aria-current={view.alertId === alert.alert_id ? 'true' : undefined}
            data-acknowledged={alert.acknowledged || undefined}
          >
            <StatusBadge level={alert.level} />
            <span className={styles.rowMain}>
              <span className={styles.message}>{alert.message}</span>
              <span className={styles.meta}>
                {alert.sensor_id} · {categoryLabel(alert.category)} · {formatRelative(alert.timestamp, now)}
              </span>
            </span>
            <span className={styles.tags}>
              {isAdmin && isAdminAlert(alert) && alert.occurrence_count > 1 && (
                <span className={styles.tag}>×{alert.occurrence_count} ocurrencias</span>
              )}
              {alert.acknowledged && <span className={styles.tag}>Revisada</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
