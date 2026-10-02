import { alertHandlers } from './alerts';
import { authHandlers } from './auth';
import { dashboardHandlers } from './dashboard';
import { sensorHandlers } from './sensors';

export const handlers = [...authHandlers, ...dashboardHandlers, ...alertHandlers, ...sensorHandlers];
