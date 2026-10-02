import type { Role } from '@gd/api';
import { useAlerts } from '@gd/query';
import { OctagonX } from 'lucide-react';
import { Link } from 'react-router';
import styles from './Home.module.css';

export function CriticalBanner({ role }: { role: Role }) {
  const { data } = useAlerts(role, { level: 'CRITICAL', acknowledged: false });
  const alerts = data?.data ?? [];
  if (alerts.length === 0) return null;

  const single = alerts.length === 1 ? alerts[0] : undefined;
  const href = single ? `/alertas?alerta=${encodeURIComponent(single.alert_id)}` : '/alertas?nivel=CRITICAL&acusada=false';
  const title = single ? '1 alerta crítica sin revisar' : `${alerts.length} alertas críticas sin revisar`;

  return (
    <section className={styles.banner} aria-label="Alertas críticas sin revisar">
      <div>
        <h2>
          <OctagonX aria-hidden="true" size={22} />
          {title}
        </h2>
        <p>{alerts[0]?.message}</p>
      </div>
      <Link className={styles.bannerLink} to={href}>
        {single ? 'Ver alerta' : 'Ver alertas'}
      </Link>
    </section>
  );
}
