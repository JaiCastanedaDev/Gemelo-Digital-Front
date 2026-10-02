import { HttpResponse, http } from 'msw';
import { authenticate, requireRole } from '../auth';
import { getSensors } from '../db';

export const sensorHandlers = [
  http.get('*/api/v1/sensors', ({ request }) => {
    const auth = authenticate(request);
    if (auth instanceof Response) return auth;
    const forbidden = requireRole(auth, ['ADMIN']);
    if (forbidden) return forbidden;
    const data = getSensors();
    return HttpResponse.json({ count: data.length, data });
  }),
];
