import { describe, expect, it } from 'vitest';
import { alertAdminSchema, alertResidenteSchema, isAdminAlert } from './alerts';

const base = {
  alert_id: 'alrt-20261002-00001',
  building_id: 'bld-1',
  sensor_id: 's1',
  level: 'CRITICAL',
  category: 'structural',
  message: 'm',
  timestamp: '2026-10-02T15:00:00Z',
  acknowledged: false,
};

describe('isAdminAlert', () => {
  it('reconoce la forma de administrador', () => {
    const admin = alertAdminSchema.parse({
      ...base,
      value_triggered: 1,
      threshold_configured: 0.5,
      occurrence_count: 2,
      acknowledged_by: null,
      acknowledged_at: null,
    });
    expect(isAdminAlert(admin)).toBe(true);
  });
  it('la forma de residente no es de administrador', () => {
    expect(isAdminAlert(alertResidenteSchema.parse(base))).toBe(false);
  });
});
