import { useMemo } from 'react';
import { ZoneDensityCard } from '../sensors/ZoneDensityCard';
import { useSensorStatuses } from '../sensors/useSensorStatuses';

/** Solo para ADMIN (los sensores no están disponibles para el residente). */
export function HomeDensity() {
  const { sensors, alertsState, statuses, retryAlerts } = useSensorStatuses();
  const list = useMemo(() => [...statuses.values()], [statuses]);
  if (!sensors.data) return null;
  return <ZoneDensityCard statuses={list} alertsState={alertsState} onRetry={retryAlerts} />;
}
