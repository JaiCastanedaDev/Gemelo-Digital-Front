import { DEFAULT_RANGE, isRangeKey, type RangeKey } from '@gd/domain';

const SENSOR_ID = /^[A-Za-z0-9_-]{1,64}$/;

export interface SensorView {
  sensorId?: string;
  range: RangeKey;
}

export function readSensorView(params: URLSearchParams): SensorView {
  const view: SensorView = { range: DEFAULT_RANGE };
  const sensorId = params.get('sensor');
  if (sensorId !== null && SENSOR_ID.test(sensorId)) view.sensorId = sensorId;
  const range = params.get('rango');
  if (isRangeKey(range)) view.range = range;
  return view;
}

export function withSensorView(
  params: URLSearchParams,
  patch: { sensorId?: string | null; range?: RangeKey },
): URLSearchParams {
  const next = new URLSearchParams(params);
  if (patch.sensorId === null) next.delete('sensor');
  else if (patch.sensorId !== undefined) next.set('sensor', patch.sensorId);
  if (patch.range !== undefined) {
    if (patch.range === DEFAULT_RANGE) next.delete('rango');
    else next.set('rango', patch.range);
  }
  if (!next.has('sensor')) next.delete('rango');
  return next;
}
