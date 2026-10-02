import { describe, expect, it } from 'vitest';
import type { AlertLevel } from './levels';
import { sortAlertsForInbox } from './alertOrder';

const a = (id: string, level: AlertLevel, acknowledged: boolean, timestamp: string) => ({
  id,
  level,
  acknowledged,
  timestamp,
});

describe('sortAlertsForInbox', () => {
  it('pone primero las sin revisar, luego las más severas y luego las más recientes', () => {
    const list = [
      a('info-new', 'INFO', false, '2026-10-02T15:00:00Z'),
      a('crit-acked', 'CRITICAL', true, '2026-10-02T16:00:00Z'),
      a('warn-old', 'WARNING', false, '2026-10-02T10:00:00Z'),
      a('crit-old', 'CRITICAL', false, '2026-10-02T09:00:00Z'),
      a('crit-new', 'CRITICAL', false, '2026-10-02T14:00:00Z'),
    ];
    expect(sortAlertsForInbox(list).map((x) => x.id)).toEqual([
      'crit-new',
      'crit-old',
      'warn-old',
      'info-new',
      'crit-acked',
    ]);
  });

  it('no modifica el arreglo original', () => {
    const list = [a('b', 'INFO', false, '2026-10-02T10:00:00Z'), a('a', 'CRITICAL', false, '2026-10-02T10:00:00Z')];
    const copy = [...list];
    sortAlertsForInbox(list);
    expect(list).toEqual(copy);
  });

  it('una fecha inválida queda al final de su grupo', () => {
    const list = [a('bad', 'WARNING', false, 'no-es-fecha'), a('ok', 'WARNING', false, '2026-10-02T10:00:00Z')];
    expect(sortAlertsForInbox(list).map((x) => x.id)).toEqual(['ok', 'bad']);
  });
});
