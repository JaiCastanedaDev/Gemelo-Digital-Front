import type { Role } from '@gd/api';
import { useAlerts } from '@gd/query';
import { Bell } from 'lucide-react';
import { Link } from 'react-router';
import styles from './AppShell.module.css';

export function AlertsBell({ role }: { role: Role }) {
  const { data } = useAlerts(role, { acknowledged: false });
  const open = data?.data ?? [];
  const count = open.length;
  const hasCritical = open.some((alert) => alert.level === 'CRITICAL');
  const label =
    count === 0 ? 'Alertas: ninguna sin revisar' : `Alertas: ${count} sin revisar${hasCritical ? ', incluye críticas' : ''}`;
  return (
    <Link to="/alertas?acusada=false" className={styles.bell} aria-label={label} data-critical={hasCritical || undefined}>
      <Bell aria-hidden="true" size={20} />
      {count > 0 && (
        <span className={styles.badge} aria-hidden="true">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}
