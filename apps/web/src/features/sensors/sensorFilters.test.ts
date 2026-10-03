import { describe, expect, it } from 'vitest';
import { readSensorFilters, writeSensorFilters } from './sensorFilters';

describe('sensorFilters', () => {
  it('lee estado, categoría y zona', () => {
    expect(readSensorFilters(new URLSearchParams('estado=OFFLINE&categoria=structural&zona=S%C3%B3tano%20Torre%201'))).toEqual({
      status: 'OFFLINE',
      category: 'structural',
      zone: 'Sótano Torre 1',
    });
  });
  it('ignora valores inválidos', () => {
    expect(readSensorFilters(new URLSearchParams(`estado=ROTO&categoria=apto&zona=${'x'.repeat(81)}`))).toEqual({});
    expect(readSensorFilters(new URLSearchParams('zona=%0Amala'))).toEqual({});
  });
  it('escribe conservando sensor y rango', () => {
    const next = writeSensorFilters(new URLSearchParams('sensor=water-main&rango=7d&estado=OK'), { category: 'consumption' });
    expect(next.toString()).toBe('sensor=water-main&rango=7d&categoria=consumption');
  });
});
