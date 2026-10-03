import { Volume2 } from 'lucide-react';
import { useRealtime } from '../../features/realtime/RealtimeProvider';
import { Button } from '../../ui/Button';
import styles from './AppShell.module.css';

export function SoundButton() {
  const { soundBlocked, enableSound } = useRealtime();
  if (!soundBlocked) return null;
  return (
    <Button variant="secondary" className={styles.iconButton} onClick={() => void enableSound()}>
      <Volume2 aria-hidden="true" size={18} />
      <span className={styles.btnText}>Activar sonido</span>
    </Button>
  );
}
