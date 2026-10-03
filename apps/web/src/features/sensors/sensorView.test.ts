import { describe, expect, it } from 'vitest';
import { readSensorView, withSensorView } from './sensorView';

describe('sensorView', () => {
  it('lee sensor y rango válidos', () => {
    expect(readSensorView(new URLSearchParams('sensor=acc-t1-sotano&rango=7d'))).toEqual({ sensorId: 'acc-t1-sotano', range: '7d' });
  });
  it('ignora valores inválidos o maliciosos', () => {
    expect(readSensorView(new URLSearchParams('sensor=%3Cscript%3E&rango=2y'))).toEqual({ range: '24h' });
    expect(readSensorView(new URLSearchParams(`sensor=${'a'.repeat(65)}`))).toEqual({ range: '24h' });
  });
  it('conserva los demás parámetros y omite el rango por defecto', () => {
    const next = withSensorView(new URLSearchParams('estado=OFFLINE'), { sensorId: 'water-main', range: '24h' });
    expect(next.toString()).toBe('estado=OFFLINE&sensor=water-main');
    expect(withSensorView(next, { sensorId: null }).toString()).toBe('estado=OFFLINE');
    expect(withSensorView(next, { range: '30d' }).get('rango')).toBe('30d');
  });
});
