import { describe, expect, it } from 'vitest';
import { buildSensorStatusMap, isOffline, type AlertInput, type SensorInput } from './sensorStatus';

const NOW = new Date('2026-10-02T15:00:00Z');
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();
const sensor = (id: string, lastSeen: string | null): SensorInput => ({
  sensor_id: id,
  zone: 'Lobby Torre 1',
  category: 'structural',
  last_seen_at: lastSeen,
});

describe('isOffline', () => {
  it('es OFFLINE si no reporta hace más de 15 min', () => {
    expect(isOffline(minutesAgo(16), NOW)).toBe(true);
  });
  it('no es OFFLINE exactamente a los 15 min', () => {
    expect(isOffline(minutesAgo(15), NOW)).toBe(false);
  });
  it('un last_seen_at sin zona horaria se lee como UTC: 10:00 a las 15:00Z es OFFLINE', () => {
    expect(isOffline('2026-10-02T10:00:00', NOW)).toBe(true);
    const map = buildSensorStatusMap([sensor('s1', '2026-10-02T10:00:00')], [], NOW);
    expect(map.get('s1')?.level).toBe('OFFLINE');
  });
  it('es OFFLINE si last_seen_at es null', () => {
    expect(isOffline(null, NOW)).toBe(true);
  });
  it('es OFFLINE si last_seen_at no es una fecha válida', () => {
    expect(isOffline('no-es-fecha', NOW)).toBe(true);
  });
  it('una fecha futura (desfase de reloj) no es OFFLINE', () => {
    expect(isOffline(new Date(NOW.getTime() + 5 * 60_000).toISOString(), NOW)).toBe(false);
  });
});

describe('buildSensorStatusMap', () => {
  it('OFFLINE prevalece sobre alertas abiertas', () => {
    const alerts: AlertInput[] = [{ sensor_id: 's1', level: 'CRITICAL', acknowledged: false }];
    const map = buildSensorStatusMap([sensor('s1', minutesAgo(40))], alerts, NOW);
    expect(map.get('s1')?.level).toBe('OFFLINE');
  });
  it('usa el nivel más severo entre alertas no acusadas', () => {
    const alerts: AlertInput[] = [
      { sensor_id: 's1', level: 'INFO', acknowledged: false },
      { sensor_id: 's1', level: 'WARNING', acknowledged: false },
      { sensor_id: 's1', level: 'CRITICAL', acknowledged: true },
    ];
    const map = buildSensorStatusMap([sensor('s1', minutesAgo(1))], alerts, NOW);
    expect(map.get('s1')?.level).toBe('WARNING');
  });
  it('es OK si solo tiene alertas acusadas', () => {
    const alerts: AlertInput[] = [{ sensor_id: 's1', level: 'CRITICAL', acknowledged: true }];
    const map = buildSensorStatusMap([sensor('s1', minutesAgo(1))], alerts, NOW);
    expect(map.get('s1')).toEqual({
      sensorId: 's1',
      level: 'OK',
      lastSeenAt: new Date(minutesAgo(1)),
      zone: 'Lobby Torre 1',
      category: 'structural',
    });
  });
  it('ignora alertas de sensores desconocidos', () => {
    const alerts: AlertInput[] = [{ sensor_id: 'otro', level: 'CRITICAL', acknowledged: false }];
    const map = buildSensorStatusMap([sensor('s1', minutesAgo(1))], alerts, NOW);
    expect(map.size).toBe(1);
    expect(map.get('s1')?.level).toBe('OK');
  });
});
