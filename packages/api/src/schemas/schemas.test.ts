import { describe, expect, it } from 'vitest';
import { alertAdminSchema, alertResidenteSchema } from './alerts';
import { loginResponseSchema } from './auth';
import { listOf } from './common';
import { comfortResidenteSchema, dashboardStructuralSchema } from './dashboard';
import { readingSchema } from './sensors';

const adminAlert = {
  alert_id: 'alrt-20261002-00001',
  building_id: 'bld-1',
  sensor_id: 'acc-t1-sotano',
  level: 'CRITICAL',
  category: 'structural',
  message: 'Aceleración superior al umbral configurado',
  timestamp: '2026-10-02T15:00:00Z',
  acknowledged: false,
  value_triggered: 0.35,
  threshold_configured: 0.2,
  occurrence_count: 12,
  acknowledged_by: null,
  acknowledged_at: null,
};

describe('schemas del contrato', () => {
  it('acepta la respuesta de login', () => {
    const parsed = loginResponseSchema.parse({
      access_token: 'a',
      refresh_token: 'r',
      token_type: 'Bearer',
      expires_in: 900,
      user: { id: 7, email: 'admin@demo.co', role: 'ADMIN', name: 'Admin' },
    });
    expect(parsed.user.id).toBe('7');
  });

  it('el schema de residente descarta los campos numéricos aunque vengan', () => {
    const parsed = alertResidenteSchema.parse(adminAlert);
    expect(parsed).not.toHaveProperty('value_triggered');
    expect(parsed).not.toHaveProperty('threshold_configured');
    expect(parsed).not.toHaveProperty('occurrence_count');
  });

  it('el schema de admin exige occurrence_count (detecta deriva)', () => {
    const withoutCount: Record<string, unknown> = { ...adminAlert };
    delete withoutCount.occurrence_count;
    expect(alertAdminSchema.safeParse(withoutCount).success).toBe(false);
  });

  it('el confort de residente descarta ppm', () => {
    const parsed = comfortResidenteSchema.parse({ zones: [{ zone: 'Gimnasio', index: 'BUENO', sensors: 1, ppm: 650 }] });
    expect(parsed.zones[0]).not.toHaveProperty('ppm');
  });

  it('alerts en estructural acepta un número o una lista y lo normaliza a número', () => {
    const parsed = dashboardStructuralSchema.parse({
      structural_score: 80,
      sensors_in_alert: [
        { sensor_id: 'a', level: 'WARNING', alerts: 2 },
        { sensor_id: 'b', level: 'CRITICAL', alerts: [{}, {}, {}] },
      ],
    });
    expect(parsed.sensors_in_alert.map((s) => s.alerts)).toEqual([2, 3]);
  });

  it('listOf acepta un arreglo o un objeto { data }', () => {
    const schema = listOf(readingSchema);
    const reading = { timestamp: '2026-10-02T15:00:00Z', unit: 'g', values: { x: 0.1 }, battery_pct: 90 };
    expect(schema.parse([reading])).toHaveLength(1);
    expect(schema.parse({ count: 1, data: [reading] })).toHaveLength(1);
  });
});
