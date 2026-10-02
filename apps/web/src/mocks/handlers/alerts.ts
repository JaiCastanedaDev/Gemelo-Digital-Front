import type { AlertAdmin, AlertResidente } from '@gd/api';
import { HttpResponse, http } from 'msw';
import { authenticate } from '../auth';
import { db } from '../db';

function toResidente(alert: AlertAdmin): AlertResidente {
  const { alert_id, building_id, sensor_id, level, category, message, timestamp, acknowledged } = alert;
  return { alert_id, building_id, sensor_id, level, category, message, timestamp, acknowledged };
}

export const alertHandlers = [
  http.get('*/api/v1/alerts', ({ request }) => {
    const auth = authenticate(request);
    if (auth instanceof Response) return auth;
    const params = new URL(request.url).searchParams;
    const level = params.get('level');
    const acknowledged = params.get('acknowledged');
    let list = [...db.alerts];
    if (level) list = list.filter((a) => a.level === level);
    if (acknowledged === 'true' || acknowledged === 'false') {
      list = list.filter((a) => a.acknowledged === (acknowledged === 'true'));
    }
    list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    const data = auth.role === 'ADMIN' ? list : list.map(toResidente);
    return HttpResponse.json({ count: data.length, data });
  }),
];
