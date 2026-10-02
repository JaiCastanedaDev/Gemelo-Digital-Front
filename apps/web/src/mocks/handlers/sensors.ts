import { HttpResponse, http } from 'msw';
import { authenticate, requireRole } from '../auth';
import { db } from '../db';

export const sensorHandlers = [
  http.get('*/api/v1/sensors', ({ request }) => {
    const auth = authenticate(request);
    if (auth instanceof Response) return auth;
    const forbidden = requireRole(auth, ['ADMIN']);
    if (forbidden) return forbidden;
    return HttpResponse.json({ count: db.sensors.length, data: db.sensors });
  }),
];
