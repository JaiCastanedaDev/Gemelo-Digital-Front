import { buildSensorStatusMap, type SensorStatus } from '@gd/domain';
import { useAlerts, useSensors } from '@gd/query';
import { useMemo } from 'react';
import { useNow } from '../../ui/useNow';

export type AlertsState = 'loading' | 'error' | 'ready';

/**
 * Estado por sensor. Sin alertas cargadas solo se confía en OFFLINE (no depende de alertas):
 * los demás quedan ausentes del mapa (desconocidos) y nunca se presentan como "Normal".
 */
export function useSensorStatuses() {
  const sensors = useSensors();
  const alerts = useAlerts('ADMIN', {});
  const now = useNow();
  const alertsState: AlertsState = alerts.data ? 'ready' : alerts.isError ? 'error' : 'loading';
  const statuses = useMemo(() => {
    const map = buildSensorStatusMap(sensors.data?.data ?? [], alerts.data?.data ?? [], now);
    if (alertsState === 'ready') return map;
    return new Map<string, SensorStatus>([...map].filter(([, s]) => s.level === 'OFFLINE'));
  }, [sensors.data, alerts.data, alertsState, now]);
  return {
    sensors,
    alerts,
    alertsState,
    statuses,
    now,
    retryAlerts: () => void alerts.refetch(),
  };
}
