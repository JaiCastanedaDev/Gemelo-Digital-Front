import type { RangeKey } from '@gd/domain';
import { useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { readSensorView, withSensorView, type SensorView } from './sensorView';

export function useSensorSelection(): {
  view: SensorView;
  select(sensorId: string): void;
  close(): void;
  setRange(range: RangeKey): void;
} {
  const [params, setParams] = useSearchParams();
  const view = readSensorView(params);
  const select = useCallback(
    (sensorId: string) => setParams((prev) => withSensorView(prev, { sensorId })),
    [setParams],
  );
  const close = useCallback(
    () => setParams((prev) => withSensorView(prev, { sensorId: null }), { replace: true }),
    [setParams],
  );
  const setRange = useCallback(
    (range: RangeKey) => setParams((prev) => withSensorView(prev, { range }), { replace: true }),
    [setParams],
  );
  return { view, select, close, setRange };
}
