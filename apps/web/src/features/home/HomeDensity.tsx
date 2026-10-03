import { buildSensorStatusMap } from '@gd/domain';
import { useAlerts, useSensors } from '@gd/query';
import { useMemo } from 'react';
import { useNow } from '../../ui/useNow';
import { ZoneDensityCard } from '../sensors/ZoneDensityCard';

/** Solo para ADMIN (los sensores no están disponibles para el residente). */
export function HomeDensity() {
  const sensors = useSensors();
  const alerts = useAlerts('ADMIN', {});
  const now = useNow();
  const statuses = useMemo(
    () => [...buildSensorStatusMap(sensors.data?.data ?? [], alerts.data?.data ?? [], now).values()],
    [sensors.data, alerts.data, now],
  );
  if (!sensors.data) return null;
  return <ZoneDensityCard statuses={statuses} />;
}
