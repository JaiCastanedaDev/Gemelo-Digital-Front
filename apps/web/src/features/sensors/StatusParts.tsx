import type { SensorStatus } from '@gd/domain';
import { Button } from '../../ui/Button';
import { StatusBadge } from '../../ui/StatusBadge';
import type { AlertsState } from './useSensorStatuses';

/** Badge del sensor; sin estado fiable muestra texto neutro, nunca "Normal". */
export function SensorStatusBadge({
  status,
  lastSeenAt,
  now,
}: {
  status: SensorStatus | undefined;
  lastSeenAt: string | null;
  now: Date;
}) {
  if (!status) return <span>Estado no disponible</span>;
  return <StatusBadge level={status.level} lastSeenAt={lastSeenAt} now={now} />;
}

export function AlertsNotice({ state, onRetry }: { state: AlertsState; onRetry: () => void }) {
  if (state === 'ready') return null;
  if (state === 'loading') return <p role="status">Calculando estados…</p>;
  return (
    <div role="alert">
      <p>No pudimos cargar las alertas; el estado de los sensores no está completo.</p>
      <Button variant="secondary" onClick={onRetry}>
        Reintentar
      </Button>
    </div>
  );
}
