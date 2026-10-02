import type { AlertAdmin } from '@gd/api';
import { isOffline } from '@gd/domain';
import { HttpResponse, http } from 'msw';
import { authenticate } from '../auth';
import { db } from '../db';

function co2Index(ppm: number): 'BUENO' | 'REGULAR' | 'MALO' {
  if (ppm < 800) return 'BUENO';
  if (ppm <= 1200) return 'REGULAR';
  return 'MALO';
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
    const offline = db.sensors.filter((s) => isOffline(s.last_seen_at, now)).length;
    return HttpResponse.json({
      health_score: Math.max(0, 100 - (25 * critical + 10 * warning + 2 * info + 5 * offline)),
      alerts_summary: { CRITICAL: critical, WARNING: warning, INFO: info, total: critical + warning + info },
      sensors: { total: db.sensors.length, online: db.sensors.length - offline, offline },
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
        const zone = { zone: s.zone, index: co2Index(ppm), sensors: [s.sensor_id] };
        return auth.role === 'ADMIN' ? { ...zone, ppm } : zone;
      });
    return HttpResponse.json({ zones });
  }),
];
