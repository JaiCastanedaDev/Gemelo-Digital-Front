import { Volume2 } from 'lucide-react';
import { useRealtime } from '../../features/realtime/RealtimeProvider';
import { Button } from '../../ui/Button';

export function SoundButton() {
  const { soundBlocked, enableSound } = useRealtime();
  if (!soundBlocked) return null;
  return (
    <Button variant="secondary" onClick={() => void enableSound()}>
      <Volume2 aria-hidden="true" size={18} />
      Activar sonido
    </Button>
  );
}
