import { HttpResponse, http } from 'msw';
import { authenticate, errorResponse, requireRole } from '../auth';
import { db, getSensors } from '../db';
import { generateReadings } from '../readings';

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const MAX_WINDOW_MS = 31 * DAY;
const OFFLINE_AGE_MS = 40 * MIN;

export const sensorHandlers = [
  http.get('*/api/v1/sensors', ({ request }) => {
    const auth = authenticate(request);
    if (auth instanceof Response) return auth;
    const forbidden = requireRole(auth, ['ADMIN']);
    if (forbidden) return forbidden;
    const data = getSensors();
    return HttpResponse.json({ count: data.length, data });
  }),

  http.get('*/api/v1/sensors/:id/data', ({ request, params }) => {
    const auth = authenticate(request);
    if (auth instanceof Response) return auth;
    const forbidden = requireRole(auth, ['ADMIN']);
    if (forbidden) return forbidden;
    const sensorId = String(params.id);
    const sensor = db.sensors.find((s) => s.sensor_id === sensorId);
    if (!sensor) return errorResponse(404, 'NOT_FOUND', 'Sensor no encontrado');

    const url = new URL(request.url);
    const now = Date.now();
    const hasta = url.searchParams.get('hasta');
    const desde = url.searchParams.get('desde');
    const to = hasta ? Date.parse(hasta) : now;
    const from = desde ? Date.parse(desde) : to - DAY;
    if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Rango inválido', [
        { path: 'desde', message: 'desde debe ser una fecha anterior a hasta' },
      ]);
    }
    if (to - from > MAX_WINDOW_MS) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Rango demasiado amplio', [
        { path: 'hasta', message: 'El rango no puede superar 31 días' },
      ]);
    }
    const readings = generateReadings(sensor, {
      from,
      to: Math.min(to, now),
      offlineSince: db.offlineSensorIds.has(sensorId) ? now - OFFLINE_AGE_MS : null,
      spikes: db.alerts
        .filter((a) => a.sensor_id === sensorId && a.level !== 'INFO' && a.value_triggered !== null)
        .map((a) => ({ t: Date.parse(a.timestamp), value: a.value_triggered ?? 0 })),
    });
    return HttpResponse.json(readings);
  }),
];
