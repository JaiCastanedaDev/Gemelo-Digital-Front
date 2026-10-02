import { Radio, RefreshCw, WifiOff, type LucideIcon } from 'lucide-react';
import styles from './Connection.module.css';
import type { ConnectionKind } from './connectionState';

const META: Record<ConnectionKind, { label: string; Icon: LucideIcon }> = {
  live: { label: 'En vivo', Icon: Radio },
  connecting: { label: 'Conectando…', Icon: RefreshCw },
  offline: { label: 'Sin conexión', Icon: WifiOff },
};

export function ConnectionIndicator({ kind }: { kind: ConnectionKind }) {
  const { label, Icon } = META[kind];
  return (
    <span className={styles.indicator} data-kind={kind} role="status">
      <Icon aria-hidden="true" size={16} />
      <span className={styles.label}>{label}</span>
    </span>
  );
}
