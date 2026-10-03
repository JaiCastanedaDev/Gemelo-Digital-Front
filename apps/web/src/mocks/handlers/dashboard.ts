import type { AlertAdmin } from '@gd/api';
import { isOffline, mostSevere, type AlertLevel } from '@gd/domain';
import { HttpResponse, http } from 'msw';
import { authenticate, requireRole } from '../auth';
import { db, getSensors } from '../db';

function co2Index(ppm: number): 'BUENO' | 'REGULAR' | 'MALO' {
  if (ppm < 800) return 'BUENO';
  if (ppm <= 1200) return 'REGULAR';
  return 'MALO';
}

function isStructural(sensorId: string): boolean {
  return db.sensors.some((s) => s.sensor_id === sensorId && s.category === 'structural');
}

/** Inicio del mes en curso en hora de Bogotá (UTC−5). */
function startOfMonthBogota(now: number): number {
  const local = new Date(now - 5 * 3_600_000);
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) + 5 * 3_600_000;
}

export const dashboardHandlers = [
  http.get('*/api/v1/dashboard/general', ({ request }) => {
    const auth = authenticate(request);
    if (auth instanceof Response) return auth;
    const now = new Date();
    const open = db.alerts.filter((a) => !a.acknowledged);
    const count = (level: AlertAdmin['level']) => open.filter((a) => a.level === level).length;
    const critical = count('CRITICAL');
    const warning = count('WARNING');
    const info = count('INFO');
    const sensors = getSensors(now.getTime());
    const offline = sensors.filter((s) => isOffline(s.last_seen_at, now)).length;
    return HttpResponse.json({
      health_score: Math.max(0, 100 - (25 * critical + 10 * warning + 2 * info + 5 * offline)),
      alerts_summary: { CRITICAL: critical, WARNING: warning, INFO: info, total: critical + warning + info },
      sensors: { total: sensors.length, online: sensors.length - offline, offline },
      generated_at: now.toISOString(),
    });
  }),

  http.get('*/api/v1/dashboard/comfort', ({ request }) => {
    const auth = authenticate(request);
    if (auth instanceof Response) return auth;
    const zones = db.sensors
      .filter((s) => s.category === 'comfort' && typeof s.last_values?.co2 === 'number')
      .map((s) => {
        const ppm = s.last_values?.co2 ?? 0;
        const index = co2Index(ppm);
        return auth.role === 'ADMIN'
          ? { zone: s.zone, index, sensors: [s.sensor_id], ppm }
          : { zone: s.zone, index, sensors: 1 };
      });
    return HttpResponse.json({ zones });
  }),

  http.get('*/api/v1/dashboard/structural', ({ request }) => {
    const auth = authenticate(request);
    if (auth instanceof Response) return auth;
    const forbidden = requireRole(auth, ['ADMIN']);
    if (forbidden) return forbidden;
    const now = new Date();
    const open = db.alerts.filter((a) => !a.acknowledged && isStructural(a.sensor_id));
    const count = (level: AlertAdmin['level']) => open.filter((a) => a.level === level).length;
    const offline = getSensors(now.getTime()).filter(
      (s) => s.category === 'structural' && isOffline(s.last_seen_at, now),
    ).length;
    const bySensor = new Map<string, AlertLevel[]>();
    for (const alert of open) bySensor.set(alert.sensor_id, [...(bySensor.get(alert.sensor_id) ?? []), alert.level]);
    return HttpResponse.json({
      structural_score: Math.max(
        0,
        100 - (25 * count('CRITICAL') + 10 * count('WARNING') + 2 * count('INFO') + 5 * offline),
      ),
      sensors_in_alert: [...bySensor.entries()].map(([sensor_id, levels]) => ({
        sensor_id,
        level: mostSevere(levels) ?? 'INFO',
        alerts: levels.length,
      })),
    });
  }),

  http.get('*/api/v1/dashboard/consumption', ({ request }) => {
    const auth = authenticate(request);
    if (auth instanceof Response) return auth;
    const forbidden = requireRole(auth, ['ADMIN']);
    if (forbidden) return forbidden;
    const now = Date.now();
    const byUnit =
      db.scenario === 'vacio'
        ? []
        : [
            { unit: 'm³', current_period: 1234.5, previous_period: 1100.2, variation_pct: 12.2 },
            db.scenario === 'caido'
              ? { unit: 'kWh', current_period: 8420, previous_period: null, variation_pct: null }
              : { unit: 'kWh', current_period: 8420, previous_period: 9010, variation_pct: -6.5 },
          ];
    return HttpResponse.json({
      period: { from: new Date(startOfMonthBogota(now)).toISOString(), to: new Date(now).toISOString() },
      by_unit: byUnit,
    });
  }),
];
