import { describe, expect, it } from 'vitest';
import { densityByZone } from './density';
import type { SensorStatus } from './sensorStatus';

const s = (zone: string, level: SensorStatus['level']): SensorStatus => ({
  sensorId: `${zone}-${level}-${Math.random()}`,
  level,
  lastSeenAt: null,
  zone,
  category: 'structural',
});

describe('densityByZone', () => {
  it('cuenta por zona y estado, en orden alfabético', () => {
    const result = densityByZone([s('Sótano', 'OK'), s('Lobby', 'OFFLINE'), s('Sótano', 'CRITICAL'), s('Sótano', 'OK')]);
    expect(result.map((z) => z.zone)).toEqual(['Lobby', 'Sótano']);
    expect(result[1]).toMatchObject({ total: 3, counts: { OK: 2, CRITICAL: 1, OFFLINE: 0, WARNING: 0, INFO: 0 } });
    expect(result[0]?.counts.OFFLINE).toBe(1);
  });
  it('sin sensores no hay zonas', () => {
    expect(densityByZone([])).toEqual([]);
  });
});
