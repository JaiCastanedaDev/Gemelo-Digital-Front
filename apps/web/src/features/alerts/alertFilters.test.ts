import { describe, expect, it } from 'vitest';
import { apiFilters, readAlertsView, writeAlertsView } from './alertFilters';

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
