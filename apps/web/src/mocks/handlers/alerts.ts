import type { AlertAdmin } from '@gd/api';
import { HttpResponse, http } from 'msw';
import { authenticate, errorResponse, requireRole } from '../auth';
import { db } from '../db';
import { toResidenteAlert } from '../serialize';

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
    const data = auth.role === 'ADMIN' ? list : list.map(toResidenteAlert);
    return HttpResponse.json({ count: data.length, data });
  }),

  http.post('*/api/v1/alerts/:id/ack', ({ request, params }) => {
    const auth = authenticate(request);
    if (auth instanceof Response) return auth;
    const forbidden = requireRole(auth, ['ADMIN']);
    if (forbidden) return forbidden;
    if (db.settings.failNextAck) {
      db.settings.failNextAck = false;
      return errorResponse(500, 'SIMULATED_FAILURE', 'Falla simulada del servidor');
    }
    const alert: AlertAdmin | undefined = db.alerts.find((a) => a.alert_id === String(params.id));
    if (!alert) return errorResponse(404, 'NOT_FOUND', 'Alerta no encontrada');
    if (!alert.acknowledged) {
      alert.acknowledged = true;
      alert.acknowledged_by = db.users.find((u) => u.id === auth.sub)?.name ?? auth.sub;
      alert.acknowledged_at = new Date().toISOString();
    }
    return HttpResponse.json(alert);
  }),
];
