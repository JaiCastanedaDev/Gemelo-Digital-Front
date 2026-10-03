import { describe, expect, it } from 'vitest';
import { createTestServices, loginAs } from '../test/renderApp';
import { db, resetDb } from './db';
import { generateReadings } from './readings';

async function apiAs(who: 'admin' | 'residente') {
  const services = createTestServices();
  await loginAs(services, who);
  return services.api;
}

function sensor(id: string) {
  const found = db.sensors.find((s) => s.sensor_id === id);
  if (!found) throw new Error(`no existe ${id}`);
  return found;
}

describe('generateReadings', () => {
  const from = Date.parse('2026-10-02T10:00:00Z');
  it('una lectura por minuto, determinista', () => {
    const a = generateReadings(sensor('acc-t1-sotano'), { from, to: from + 3_600_000, offlineSince: null, spikes: [] });
    const b = generateReadings(sensor('acc-t1-sotano'), { from, to: from + 3_600_000, offlineSince: null, spikes: [] });
    expect(a).toHaveLength(60);
    expect(a).toEqual(b);
    expect(Object.keys(a[0]?.values ?? {})).toEqual(['x', 'y', 'z']);
  });
  it('se detiene cuando el sensor deja de reportar', () => {
    const out = generateReadings(sensor('co2-gym'), { from, to: from + 3_600_000, offlineSince: from + 600_000, spikes: [] });
    expect(out).toHaveLength(10);
  });
  it('marca el valor de la alerta cerca de su instante', () => {
    const t = from + 1_800_000;
    const out = generateReadings(sensor('acc-t1-sotano'), { from, to: from + 3_600_000, offlineSince: null, spikes: [{ t, value: 0.35 }] });
    expect(out.find((r) => r.timestamp === new Date(t).toISOString())?.values.x).toBe(0.35);
  });
  it('la fisura oscila lentamente sin saltos', () => {
    const day = 86_400_000;
    const out = generateReadings(sensor('crack-t2-cubierta'), { from: 0, to: 400 * day, offlineSince: null, spikes: [] });
    const widths = out.filter((_, i) => i % 1440 === 0).map((r) => r.values.width ?? 0);
    for (let i = 1; i < widths.length; i += 1) {
      expect(Math.abs((widths[i] ?? 0) - (widths[i - 1] ?? 0))).toBeLessThan(0.05);
    }
  });
});

describe('handlers de lecturas y dashboards', () => {
  it('lecturas de la última hora', async () => {
    const api = await apiAs('admin');
    const now = Date.now();
    const readings = await api.sensors.readings('water-main', {
      desde: new Date(now - 3_600_000).toISOString(),
      hasta: new Date(now).toISOString(),
    });
    expect(readings.length).toBeGreaterThanOrEqual(59);
    expect(readings.length).toBeLessThanOrEqual(60);
  });

  it('rechaza ventanas mayores a 31 días y rangos invertidos', async () => {
    const api = await apiAs('admin');
    await expect(
      api.sensors.readings('water-main', { desde: '2026-08-01T00:00:00Z', hasta: '2026-10-02T00:00:00Z' }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      api.sensors.readings('water-main', { desde: '2026-10-02T00:00:00Z', hasta: '2026-10-01T00:00:00Z' }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('el residente no puede pedir lecturas ni dashboards de administrador', async () => {
    const api = await apiAs('residente');
    await expect(api.sensors.readings('water-main', {})).rejects.toMatchObject({ status: 403 });
    await expect(api.dashboard.structural()).rejects.toMatchObject({ status: 403 });
    await expect(api.dashboard.consumption()).rejects.toMatchObject({ status: 403 });
  });

  it.each([
    ['sano', 100],
    ['critico', 60],
    ['caido', 70],
    ['vacio', 100],
  ] as const)('estructural en %s → %i', async (scenario, score) => {
    resetDb(scenario);
    const api = await apiAs('admin');
    expect((await api.dashboard.structural()).structural_score).toBe(score);
  });

  it('en crítico lista los sensores estructurales en alerta', async () => {
    resetDb('critico');
    const api = await apiAs('admin');
    const { sensors_in_alert } = await api.dashboard.structural();
    expect(sensors_in_alert).toEqual(
      expect.arrayContaining([
        { sensor_id: 'acc-t1-sotano', level: 'CRITICAL', alerts: 1 },
        { sensor_id: 'crack-t2-cubierta', level: 'WARNING', alerts: 1 },
      ]),
    );
  });

  it('consumos: variación normal y nula en caído', async () => {
    resetDb('sano');
    const api = await apiAs('admin');
    const sano = await api.dashboard.consumption();
    expect(sano.by_unit).toEqual([
      { unit: 'm³', current_period: 1234.5, previous_period: 1100.2, variation_pct: 12.2 },
      { unit: 'kWh', current_period: 8420, previous_period: 9010, variation_pct: -6.5 },
    ]);
    resetDb('caido');
    const caido = await api.dashboard.consumption();
    expect(caido.by_unit[1]).toMatchObject({ unit: 'kWh', previous_period: null, variation_pct: null });
  });

  it('confort: el residente recibe un conteo de sensores y el administrador los ids', async () => {
    const res = await (await apiAs('residente')).dashboard.comfortResidente();
    expect(res.zones.length).toBeGreaterThan(0);
    for (const z of res.zones) expect(typeof z.sensors).toBe('number');
    const adm = await (await apiAs('admin')).dashboard.comfortAdmin();
    for (const z of adm.zones) expect(Array.isArray(z.sensors)).toBe(true);
  });
});
