import { describe, expect, it } from 'vitest';
import { apiFilters, matchesClientFilters, readAlertsView, writeAlertsView } from './alertFilters';

describe('alertFilters', () => {
  it('lee nivel, estado, categoría y alerta', () => {
    const view = readAlertsView(
      new URLSearchParams('nivel=CRITICAL&acusada=false&categoria=structural&alerta=alrt-20261002-00004'),
    );
    expect(view).toEqual({ level: 'CRITICAL', acknowledged: false, category: 'structural', alertId: 'alrt-20261002-00004' });
  });

  it('ignora valores inválidos o maliciosos', () => {
    const view = readAlertsView(
      new URLSearchParams('nivel=PANICO&acusada=quizas&categoria=apartamento&alerta=%3Cscript%3E'),
    );
    expect(view).toEqual({});
    expect(readAlertsView(new URLSearchParams(`alerta=${'a'.repeat(65)}`))).toEqual({});
  });

  it('escribe en un orden estable y omite lo vacío', () => {
    expect(writeAlertsView({ acknowledged: true, level: 'WARNING' }).toString()).toBe('nivel=WARNING&acusada=true');
    expect(writeAlertsView({}).toString()).toBe('');
  });

  it('solo nivel y estado van a la API', () => {
    expect(apiFilters({ level: 'INFO', acknowledged: false, category: 'comfort', alertId: 'x' })).toEqual({
      level: 'INFO',
      acknowledged: false,
    });
    expect(apiFilters({})).toEqual({});
  });
});

describe('filtros de sensor y fechas', () => {
  it('lee y escribe sensor y fechas válidos', () => {
    const view = readAlertsView(new URLSearchParams('sensor=acc-t1-sotano&desde=2026-10-01&hasta=2026-10-02'));
    expect(view).toEqual({ sensorId: 'acc-t1-sotano', from: '2026-10-01', to: '2026-10-02' });
    expect(writeAlertsView({ ...view, level: 'CRITICAL', alertId: 'x' }).toString()).toBe(
      'nivel=CRITICAL&sensor=acc-t1-sotano&desde=2026-10-01&hasta=2026-10-02&alerta=x',
    );
  });

  it('ignora fechas inválidas y sensores maliciosos', () => {
    expect(readAlertsView(new URLSearchParams('sensor=%3Cx%3E&desde=2026-02-30&hasta=ayer'))).toEqual({});
  });

  it('filtra por sensor y por día de Bogotá; un rango invertido no filtra fechas', () => {
    const alert = {
      alert_id: 'a',
      building_id: 'b',
      sensor_id: 's1',
      level: 'WARNING' as const,
      category: 'structural',
      message: 'm',
      timestamp: '2026-10-02T04:30:00Z', // 1 oct, 11:30 p. m. en Bogotá
      acknowledged: false,
    };
    expect(matchesClientFilters(alert, { sensorId: 's1' })).toBe(true);
    expect(matchesClientFilters(alert, { sensorId: 's2' })).toBe(false);
    expect(matchesClientFilters(alert, { from: '2026-10-01', to: '2026-10-01' })).toBe(true);
    expect(matchesClientFilters(alert, { from: '2026-10-02' })).toBe(false);
    expect(matchesClientFilters(alert, { from: '2026-10-05', to: '2026-10-01' })).toBe(true);
  });
});
