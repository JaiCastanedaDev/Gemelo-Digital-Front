import { formatRelative } from '@gd/domain';
import { WifiOff } from 'lucide-react';
import { useNow } from '../../ui/useNow';
import styles from './Connection.module.css';
import { useLastDataUpdate } from './useLastDataUpdate';

export function OfflineBanner({ visible }: { visible: boolean }) {
  const lastUpdate = useLastDataUpdate();
  const now = useNow();
  if (!visible) return null;
  const since = lastUpdate === null ? null : formatRelative(new Date(lastUpdate).toISOString(), now);
  const detail =
    since === null
      ? 'Mostrando los últimos datos disponibles.'
      : since === 'justo ahora'
        ? 'Mostrando los datos más recientes que recibimos.'
        : `Mostrando datos de ${since}.`;
  return (
    <div className={styles.banner} role="status">
      <WifiOff aria-hidden="true" size={20} />
      <p>
        <strong>Sin conexión con el servidor.</strong> {detail}
      </p>
    </div>
  );
}
